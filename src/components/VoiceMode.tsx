"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useSpotifyPlayer } from "@/hooks/useSpotifyPlayer";

type VoicePhase =
  | "idle"
  | "recording"
  | "transcribing"
  | "transcribed"
  | "sending_to_agent"
  | "agent_responded"
  | "generating_speech"
  | "playing";

interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface VoiceModeProps {
  onClose: () => void;
}

const PHASE_LABELS: Record<VoicePhase, string> = {
  idle: "Tap to speak",
  recording: "Listening...",
  transcribing: "Transcribing your voice...",
  transcribed: "Audio transcribed!",
  sending_to_agent: "Sent to agent...",
  agent_responded: "Agent responded",
  generating_speech: "Converting to speech...",
  playing: "Playing response...",
};

export default function VoiceMode({ onClose }: VoiceModeProps) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [statusText, setStatusText] = useState("Tap to speak");
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [spotifyStarted, setSpotifyStarted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoRecordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const spotifyContainerRef = useRef<HTMLDivElement | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");

  const recorder = useVoiceRecorder();
  const spotify = useSpotifyPlayer();

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    document.body.classList.add("voice-mode-active");
    return () => {
      document.body.classList.remove("voice-mode-active");
    };
  }, []);

  // Initialize Spotify embed when container mounts
  const spotifyRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      spotifyContainerRef.current = node;
      spotify.init(node);
    },
    [spotify.init]
  );

  // Draw audio visualization ring
  useEffect(() => {
    if (!canvasRef.current || !recorder.analyserData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const radius = size / 2 - 20;

    ctx.clearRect(0, 0, size, size);

    const data = recorder.analyserData;
    const barCount = 64;
    const step = Math.floor(data.length / barCount);

    for (let i = 0; i < barCount; i++) {
      const value = data[i * step] / 255;
      const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
      const barHeight = 4 + value * 30;

      const x1 = center + Math.cos(angle) * radius;
      const y1 = center + Math.sin(angle) * radius;
      const x2 = center + Math.cos(angle) * (radius + barHeight);
      const y2 = center + Math.sin(angle) * (radius + barHeight);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = `rgba(99, 102, 241, ${0.4 + value * 0.6})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }, [recorder.analyserData]);

  // ---- Spotify auto-play/pause tied to voice phase ----
  useEffect(() => {
    const shouldPause = phase === "recording" || phase === "playing";
    const isWaiting =
      phase === "idle" ||
      phase === "transcribing" ||
      phase === "transcribed" ||
      phase === "sending_to_agent" ||
      phase === "agent_responded" ||
      phase === "generating_speech";

    if (shouldPause) {
      // Pause Spotify when recording or playing TTS
      if (spotify.playerState === "playing") {
        spotify.pause();
      }
    } else if (isWaiting) {
      // Resume Spotify when idle or waiting for AI, but only if user already started it
      if (spotify.playerState === "paused" && spotifyStarted) {
        spotify.resume();
      }
    }

    if ((spotify.playerState === "playing" || spotify.playerState === "paused") && !spotifyStarted) {
      setSpotifyStarted(true);
    }
  }, [phase, spotify.playerState, spotifyStarted, spotify]);

  // ---- Handle recording start ----
  const handleStartRecording = useCallback(async () => {
    if (
      phase === "transcribing" ||
      phase === "sending_to_agent" ||
      phase === "generating_speech" ||
      phase === "playing"
    )
      return;

    setError(null);
    await recorder.startRecording();
    setPhase("recording");
    setStatusText(PHASE_LABELS.recording);
  }, [phase, recorder]);

  // ---- Handle recording stop ----
  const handleStopRecording = useCallback(async () => {
    if (phase !== "recording") return;

    recorder.stopRecording();

    // Wait for blob from onstop callback
    await new Promise((r) => setTimeout(r, 200));
  }, [phase, recorder]);

  // ---- Process audio blob via SSE when ready ----
  useEffect(() => {
    if (!recorder.audioBlob || phase !== "recording") return;

    const blob = recorder.audioBlob;
    recorder.clearBlob();
    processAudioViaSSE(blob);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.audioBlob]);

  const processAudioViaSSE = async (blob: Blob) => {
    setPhase("transcribing");
    setStatusText(PHASE_LABELS.transcribing);

    try {
      // Convert blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Build conversation history for context
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      // Abort any previous request
      if (abortRef.current) abortRef.current.abort();
      const abort = new AbortController();
      abortRef.current = abort;

      const res = await fetch("/api/voice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: base64Audio,
          conversationHistory,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Voice API returned ${res.status}`);
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (split by double newline)
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // keep incomplete event in buffer

        for (const eventStr of events) {
          if (!eventStr.trim()) continue;

          // Parse "event: xxx\ndata: {...}"
          const lines = eventStr.split("\n");
          let data = "";
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              data = line.substring(6);
            }
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);
            handleSSEEvent(parsed);
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      console.error("Voice SSE error:", err);
      setError(err.message || "Voice chat failed");
      setPhase("idle");
      setStatusText(PHASE_LABELS.idle);
    }
  };

  // ---- Handle individual SSE events ----
  const handleSSEEvent = useCallback(
    (data: Record<string, unknown>) => {
      const step = data.step as string;

      switch (step) {
        case "saving_audio":
          // Still in transcribing phase visually
          break;

        case "transcribing":
          setPhase("transcribing");
          setStatusText(PHASE_LABELS.transcribing);
          break;

        case "transcribed": {
          const transcription = (data.transcription as string) || "";
          setPhase("transcribed");
          setStatusText(
            `Transcribed: "${transcription.substring(0, 60)}${transcription.length > 60 ? "..." : ""}"`
          );
          // Add user message
          if (transcription) {
            setMessages((prev) => [
              ...prev,
              {
                id: `user-${Date.now()}`,
                role: "user",
                text: transcription,
                timestamp: Date.now(),
              },
            ]);
          }
          break;
        }

        case "sending_to_agent":
          setPhase("sending_to_agent");
          setStatusText(PHASE_LABELS.sending_to_agent);
          break;

        case "agent_responded": {
          const text = (data.text as string) || "";
          setPhase("agent_responded");
          setStatusText("Agent responded");
          if (text) {
            setMessages((prev) => [
              ...prev,
              {
                id: `assistant-${Date.now()}`,
                role: "assistant",
                text,
                timestamp: Date.now(),
              },
            ]);
          }
          break;
        }

        case "generating_speech":
          setPhase("generating_speech");
          setStatusText(PHASE_LABELS.generating_speech);
          break;

        case "speech_ready":
          if (data.audio) {
            setPhase("playing");
            setStatusText(PHASE_LABELS.playing);
            playResponseAudio(data.audio as string);
          }
          break;

        case "tts_warning":
          // TTS failed but we have the text — go back to idle
          setPhase("idle");
          setStatusText("Speech unavailable — see transcript");
          scheduleAutoRecord();
          break;

        case "complete":
          // If we're not already playing audio, go to idle
          if (phaseRef.current !== "playing") {
            setPhase("idle");
            setStatusText(PHASE_LABELS.idle);
            scheduleAutoRecord();
          }
          break;

        case "error":
          setError((data.message as string) || "Something went wrong");
          setPhase("idle");
          setStatusText(PHASE_LABELS.idle);
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ---- Play TTS audio response ----
  const playResponseAudio = useCallback((audioDataUrl: string) => {
    const audio = new Audio(audioDataUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setPhase("idle");
      setStatusText(PHASE_LABELS.idle);
      audioRef.current = null;
      scheduleAutoRecord();
    };

    audio.onerror = () => {
      console.error("Audio playback error");
      setPhase("idle");
      setStatusText(PHASE_LABELS.idle);
      audioRef.current = null;
      scheduleAutoRecord();
    };

    audio.play().catch((err) => {
      console.error("Failed to play audio:", err);
      setPhase("idle");
      setStatusText(PHASE_LABELS.idle);
      scheduleAutoRecord();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-record after TTS ends ----
  const scheduleAutoRecord = useCallback(() => {
    if (autoRecordTimeoutRef.current) {
      clearTimeout(autoRecordTimeoutRef.current);
    }

    autoRecordTimeoutRef.current = setTimeout(async () => {
      try {
        await recorder.startRecording();
        setPhase("recording");
        setStatusText(PHASE_LABELS.recording);
      } catch (err) {
        console.error("Auto-record failed:", err);
      }
    }, 1500);
  }, [recorder]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => {
      if (autoRecordTimeoutRef.current) {
        clearTimeout(autoRecordTimeoutRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
      spotify.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Handle main circle tap ----
  const handleCircleTap = useCallback(() => {
    if (phase === "idle") {
      if (autoRecordTimeoutRef.current) {
        clearTimeout(autoRecordTimeoutRef.current);
      }
      handleStartRecording();
    } else if (phase === "recording") {
      handleStopRecording();
    } else if (phase === "playing") {
      // Stop playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPhase("idle");
      setStatusText(PHASE_LABELS.idle);
    }
  }, [phase, handleStartRecording, handleStopRecording]);

  // ---- Handle close ----
  const handleClose = useCallback(() => {
    if (autoRecordTimeoutRef.current) {
      clearTimeout(autoRecordTimeoutRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (recorder.isRecording) {
      recorder.stopRecording();
    }
    if (abortRef.current) {
      abortRef.current.abort();
    }
    spotify.destroy();
    onClose();
  }, [recorder, spotify, onClose]);

  // ---- Visual state mapping ----
  const isProcessing =
    phase === "transcribing" ||
    phase === "transcribed" ||
    phase === "sending_to_agent" ||
    phase === "agent_responded" ||
    phase === "generating_speech";

  const circleClasses =
    phase === "recording"
      ? "bg-red-500/10 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]"
      : isProcessing
        ? "bg-indigo-500/10 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)]"
        : phase === "playing"
          ? "bg-emerald-500/10 border-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          : "bg-[var(--surface)] border-[var(--border)] shadow-lg";

  const circleIcon =
    phase === "recording"
      ? "stop"
      : isProcessing
        ? "hourglass_top"
        : phase === "playing"
          ? "volume_up"
          : "mic";

  const ambientColor =
    phase === "recording"
      ? "bg-red-500"
      : isProcessing
        ? "bg-indigo-500"
        : phase === "playing"
          ? "bg-emerald-500"
          : "bg-blue-500/50";

  return (
      <div className="fixed inset-0 z-[70] bg-[var(--background)] flex flex-col items-center justify-between overflow-hidden voice-mode-bg">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-20 transition-colors duration-1000 ${ambientColor}`}
        />
      </div>

      {/* Top bar */}
      <div className="relative z-10 w-full flex items-center justify-between px-6 pt-14 pb-4">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors active:scale-95"
        >
          <span className="material-icons text-[20px]">close</span>
        </button>

        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              phase === "idle"
                ? "bg-[var(--text-secondary)]"
                : phase === "recording"
                  ? "bg-red-500 animate-pulse"
                  : isProcessing
                    ? "bg-indigo-500 animate-pulse"
                    : "bg-emerald-500 animate-pulse"
            }`}
          />
          <span className="text-[13px] font-light text-[var(--text-secondary)]">
            Voice Mode
          </span>
        </div>

        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className={`w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center transition-colors active:scale-95 ${
            showTranscript
              ? "text-[var(--text-primary)]"
              : "text-[var(--text-secondary)]"
          }`}
        >
          <span className="material-icons text-[20px]">
            {showTranscript ? "chat_bubble" : "chat_bubble_outline"}
          </span>
        </button>
      </div>

      {/* Transcript overlay */}
      {showTranscript && messages.length > 0 && (
        <div className="absolute top-24 bottom-48 left-0 right-0 z-20 px-6 overflow-y-auto hide-scrollbar">
          <div className="space-y-3 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 backdrop-blur-sm ${
                    msg.role === "user"
                      ? "bg-[var(--text-primary)]/80 text-[var(--background)] rounded-br-md"
                      : "bg-[var(--surface)]/80 text-[var(--text-primary)] rounded-bl-md border border-[var(--border)]/50"
                  }`}
                >
                  <p className="text-[13px] font-light leading-relaxed">
                    {msg.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Center: Main voice circle */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-8">
        <div className="relative">
          {/* Audio visualization canvas */}
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: 280, height: 280 }}
          />

          {/* Pulse rings for recording */}
          {phase === "recording" && (
            <>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full border border-red-400/30 voice-pulse-ring" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full border border-red-400/20 voice-pulse-ring-delayed" />
            </>
          )}

          {/* Spinning ring for processing */}
          {isProcessing && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full border-2 border-transparent border-t-indigo-400 border-r-indigo-400/50 voice-spin" />
          )}

          {/* Breathing ring for speaking */}
          {phase === "playing" && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] rounded-full border border-emerald-400/40 voice-breathe" />
          )}

          {/* Main circle button */}
          <button
            onClick={handleCircleTap}
            disabled={isProcessing}
            className={`relative w-[140px] h-[140px] rounded-full border-2 flex items-center justify-center transition-all duration-500 active:scale-95 disabled:opacity-70 ${circleClasses}`}
          >
            <span
              className={`material-icons text-[48px] transition-all duration-300 ${
                phase === "recording"
                  ? "text-red-500"
                  : isProcessing
                    ? "text-indigo-400 animate-spin"
                    : phase === "playing"
                      ? "text-emerald-500"
                      : "text-[var(--text-secondary)]"
              }`}
            >
              {circleIcon}
            </span>
          </button>
        </div>

        {/* Status text — shows real-time phase */}
        <div className="text-center">
          <p className="text-[var(--text-primary)] text-base font-light">
            {statusText}
          </p>
          {phase === "idle" && !error && (
            <p className="text-[var(--text-secondary)] text-xs font-light mt-1 opacity-60">
              Tap the circle to start talking
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <p className="text-red-500 text-[12px] font-light text-center">
              {error}
            </p>
            <button
              onClick={() => setError(null)}
              className="mt-1 text-red-400 text-[11px] underline mx-auto block"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Last message preview */}
        {!showTranscript && messages.length > 0 && (
          <div className="mx-8 max-w-sm text-center">
            <p className="text-[var(--text-secondary)] text-[12px] font-light line-clamp-2 opacity-70">
              {messages[messages.length - 1]?.text}
            </p>
          </div>
        )}
      </div>

      {/* Bottom: Spotify embed player */}
      <div className="relative z-10 w-full px-6 pb-10">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
          {/* Spotify Embed iframe container — controlled by useSpotifyPlayer */}
          <div
            ref={spotifyRefCallback}
            className="w-full min-h-[120px] [&>iframe]:rounded-2xl [&>iframe]:min-h-[120px]"
          />
        </div>
      </div>
    </div>
  );
}
