import { NextRequest } from "next/server";
import { getOpenClawUrls } from "@/lib/openclaw";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import path from "path";
import os from "os";

const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;
const VOICE_READ_SCRIPT =
  "/home/anmol/.openclaw/workspace/skills/voice-read/scripts/voice_read.py";
const TTS_VOICE = "af_bella";

/**
 * POST /api/voice/chat
 * 
 * Streaming voice chat endpoint. Sends Server-Sent Events so the frontend
 * can show real-time phase updates as each step completes.
 * 
 * Body: { audio: string (base64 data URL), conversationHistory?: {role,content}[] }
 * 
 * SSE events sent:
 *   phase:saving_audio     - Audio received, saving to disk
 *   phase:transcribing     - Running Faster Whisper STT
 *   phase:transcribed      - Transcription complete (includes text)
 *   phase:sending_to_agent - Sending text to OpenClaw AI
 *   phase:agent_responded  - AI response received (includes text)
 *   phase:generating_speech - Converting response to speech via Kokoro TTS
 *   phase:speech_ready     - TTS audio ready (includes base64 audio)
 *   phase:complete         - All done
 *   phase:error            - Something failed (includes error message)
 */
export async function POST(request: NextRequest) {
  const ts = Date.now();
  const tmpDir = os.tmpdir();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: Record<string, unknown>) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      let audioInputPath = "";
      let ttsOutputPath = "";

      try {
        const body = await request.json();
        const { audio, conversationHistory } = body;

        if (!audio) {
          sendEvent("phase", { step: "error", message: "No audio data received" });
          controller.close();
          return;
        }

        // --- Step 1: Save audio to temp file ---
        sendEvent("phase", { step: "saving_audio", message: "Receiving audio..." });

        const base64Data = audio.includes(",") ? audio.split(",")[1] : audio;
        const audioBuffer = Buffer.from(base64Data, "base64");

        // Detect format from data URL
        let ext = "webm";
        if (audio.startsWith("data:audio/wav")) ext = "wav";
        else if (audio.startsWith("data:audio/mp3") || audio.startsWith("data:audio/mpeg")) ext = "mp3";
        else if (audio.startsWith("data:audio/ogg")) ext = "ogg";

        audioInputPath = path.join(tmpDir, `voice_input_${ts}.${ext}`);
        writeFileSync(audioInputPath, audioBuffer);

        // --- Step 2: Transcribe with Faster Whisper ---
        sendEvent("phase", { step: "transcribing", message: "Transcribing your voice..." });

        let transcription = "";
        try {
          // Use voice_read.py directly - it prints "Language: xx (prob)\n\nTranscribed text"
          const output = execSync(
            `python3 "${VOICE_READ_SCRIPT}" "${audioInputPath}"`,
            { timeout: 45000, encoding: "utf-8", env: { ...process.env, PATH: process.env.PATH } }
          );

          // Parse: skip "Language: ..." line, collect actual text
          const lines = output.trim().split("\n");
          transcription = lines
            .filter((l) => !l.startsWith("Language:") && l.trim().length > 0)
            .join(" ")
            .trim();
        } catch (err: any) {
          console.error("Transcription error:", err.stderr || err.message);
          sendEvent("phase", {
            step: "error",
            message: `Transcription failed: ${err.stderr?.substring(0, 200) || err.message}`,
          });
          cleanup(audioInputPath, "");
          controller.close();
          return;
        }

        if (!transcription) {
          sendEvent("phase", {
            step: "error",
            message: "No speech detected in the recording. Try speaking louder or closer to the mic.",
          });
          cleanup(audioInputPath, "");
          controller.close();
          return;
        }

        sendEvent("phase", {
          step: "transcribed",
          message: "Audio transcribed",
          transcription,
        });

        // --- Step 3: Send to OpenClaw via /v1/chat/completions ---
        sendEvent("phase", {
          step: "sending_to_agent",
          message: "Sending to AI agent...",
        });

        const urls = getOpenClawUrls();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (OPENCLAW_TOKEN) {
          headers["Authorization"] = `Bearer ${OPENCLAW_TOKEN}`;
        }

        // Build conversation messages - include history for context
        const messages: { role: string; content: string }[] = [
          {
            role: "system",
            content:
              "You are having a voice conversation. Keep responses concise and conversational — 1-3 sentences. Avoid code blocks, markdown, or overly technical formatting. Speak naturally as if talking to a friend.",
          },
        ];

        if (conversationHistory && Array.isArray(conversationHistory)) {
          for (const msg of conversationHistory) {
            messages.push({ role: msg.role, content: msg.content });
          }
        }

        messages.push({ role: "user", content: transcription });

        let responseText = "";
        let lastError: Error | null = null;

        for (const baseUrl of urls) {
          try {
            const res = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: "openclaw",
                messages,
              }),
              signal: AbortSignal.timeout(120000),
            });

            if (!res.ok) {
              const errText = await res.text();
              lastError = new Error(errText || `HTTP ${res.status}`);
              continue;
            }

            const data = await res.json();
            responseText = data.choices?.[0]?.message?.content || "";
            break;
          } catch (err: any) {
            lastError = err;
            continue;
          }
        }

        if (!responseText) {
          sendEvent("phase", {
            step: "error",
            message: `AI agent did not respond: ${lastError?.message || "No response"}`,
          });
          cleanup(audioInputPath, "");
          controller.close();
          return;
        }

        sendEvent("phase", {
          step: "agent_responded",
          message: "AI responded",
          text: responseText,
        });

        // --- Step 4: Generate speech with Kokoro TTS ---
        sendEvent("phase", {
          step: "generating_speech",
          message: "Converting response to speech...",
        });

        let audioBase64: string | null = null;
        ttsOutputPath = path.join(tmpDir, `voice_response_${ts}.wav`);

        try {
          const cleanText = cleanForTTS(responseText);
          const ttsText =
            cleanText.length > 2000
              ? cleanText.substring(0, 2000) + "..."
              : cleanText;

          // Write text to a temp file to avoid shell escaping issues
          const textFilePath = path.join(tmpDir, `voice_text_${ts}.txt`);
          writeFileSync(textFilePath, ttsText, "utf-8");

          // Use Python to call Kokoro TTS with text from file
          execSync(
            `python3 -c "
import sys
sys.path.insert(0, '/home/anmol/.local/bin')
text = open('${textFilePath}').read()
import soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro('/home/anmol/.kokoro/kokoro-v0_19.onnx', '/home/anmol/.kokoro/voices.bin')
audio, sr = k.create(text, voice='${TTS_VOICE}')
sf.write('${ttsOutputPath}', audio, sr)
print('OK')
"`,
            { timeout: 90000, encoding: "utf-8" }
          );

          // Cleanup text file
          try { unlinkSync(textFilePath); } catch {}

          if (existsSync(ttsOutputPath)) {
            const audioData = readFileSync(ttsOutputPath);
            audioBase64 = `data:audio/wav;base64,${audioData.toString("base64")}`;
          }
        } catch (err: any) {
          console.error("TTS error:", err.stderr || err.message);
          // Don't fail — the text response is still valuable
          sendEvent("phase", {
            step: "tts_warning",
            message: "Speech generation had an issue, but text response is ready.",
          });
        }

        if (audioBase64) {
          sendEvent("phase", {
            step: "speech_ready",
            message: "Speech ready",
            audio: audioBase64,
          });
        }

        // --- Done ---
        sendEvent("phase", {
          step: "complete",
          message: "Done",
          transcription,
          text: responseText,
          audio: audioBase64,
        });

        cleanup(audioInputPath, ttsOutputPath);
        controller.close();
      } catch (error: any) {
        console.error("Voice chat stream error:", error);
        sendEvent("phase", {
          step: "error",
          message: error.message || "Voice chat failed unexpectedly",
        });
        cleanup(audioInputPath, ttsOutputPath);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/** Clean temp files */
function cleanup(inputPath: string, outputPath: string) {
  try { if (inputPath && existsSync(inputPath)) unlinkSync(inputPath); } catch {}
  try { if (outputPath && existsSync(outputPath)) unlinkSync(outputPath); } catch {}
}

/** Strip markdown for natural speech */
function cleanForTTS(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " code block omitted ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
