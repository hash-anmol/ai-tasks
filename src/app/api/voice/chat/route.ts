import { NextRequest } from "next/server";
import { getOpenClawUrls, getOpenClawAuth } from "@/lib/openclaw";

const TTS_VOICE = "af_bella";

function getLocalVoiceUrl(): string {
  // Use Tailscale funnel URL for local voice API
  const baseUrl = process.env.NEXT_PUBLIC_OPENCLAW_URL || "https://homeserver.tail07d4a6.ts.net";
  // Voice API runs on port 18791
  return baseUrl.replace(":18789", ":18791");
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: string, data: Record<string, unknown>) {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      try {
        const body = await request.json();
        const { audio, conversationHistory } = body;

        if (!audio) {
          sendEvent("phase", { step: "error", message: "No audio data received" });
          controller.close();
          return;
        }

        // --- Step 1: Save audio ---
        sendEvent("phase", { step: "saving_audio", message: "Receiving audio..." });

        const base64Data = audio.includes(",") ? audio.split(",")[1] : audio;
        const audioBuffer = Buffer.from(base64Data, "base64");

        // --- Step 2: Transcribe with local Faster Whisper ---
        sendEvent("phase", { step: "transcribing", message: "Transcribing your voice..." });

        const localVoiceUrl = getLocalVoiceUrl();
        let transcription = "";
        
        try {
          const transcribeRes = await fetch(`${localVoiceUrl}/transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: audioBuffer.toString("base64"),
            signal: AbortSignal.timeout(60000),
          });

          if (!transcribeRes.ok) {
            throw new Error(`Transcription failed: ${transcribeRes.statusText}`);
          }

          const transcribeData = await transcribeRes.json();
          transcription = transcribeData.text || "";
          
          sendEvent("phase", { 
            step: "transcribed", 
            message: transcription,
            language: transcribeData.language 
          });
        } catch (err: any) {
          console.error("Transcription error:", err.message);
          sendEvent("phase", {
            step: "error",
            message: `Transcription failed: ${err.message}`,
          });
          controller.close();
          return;
        }

        if (!transcription.trim()) {
          sendEvent("phase", { step: "error", message: "No speech detected" });
          controller.close();
          return;
        }

        // --- Step 3: Send to OpenClaw ---
        sendEvent("phase", { step: "sending_to_agent", message: "Getting AI response..." });

        const urls = getOpenClawUrls();
        let aiResponse = "";
        
        for (const url of urls) {
          const { baseUrl, header } = getOpenClawAuth(url);
          try {
            const messages = [
              ...(conversationHistory || []).slice(-10),
              { role: "user", content: transcription }
            ];

            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(header && { Authorization: header }),
              },
              body: JSON.stringify({
                model: "openclaw",
                messages,
              }),
              signal: AbortSignal.timeout(120000),
            });

            if (!response.ok) continue;

            const data = await response.json();
            aiResponse = data.choices?.[0]?.message?.content || "";
            break;
          } catch (e) {
            continue;
          }
        }

        if (!aiResponse) {
          sendEvent("phase", { step: "error", message: "Failed to get AI response" });
          controller.close();
          return;
        }

        sendEvent("phase", { 
          step: "agent_responded", 
          message: aiResponse 
        });

        // --- Step 4: Generate TTS with local Kokoro ---
        sendEvent("phase", { step: "generating_speech", message: "Generating voice response..." });

        try {
          const ttsRes = await fetch(`${localVoiceUrl}/tts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              text: aiResponse.substring(0, 1000), // Limit text length
              voice: TTS_VOICE 
            }),
            signal: AbortSignal.timeout(60000),
          });

          if (!ttsRes.ok) {
            throw new Error(`TTS failed: ${ttsRes.statusText}`);
          }

          const ttsData = await ttsRes.json();
          
          sendEvent("phase", { 
            step: "speech_ready", 
            audio: ttsData.audio 
          });
        } catch (err: any) {
          console.error("TTS error:", err.message);
          // Don't fail - just send text response
          sendEvent("phase", { 
            step: "speech_ready", 
            audio: null,
            message: "Voice generation failed, showing text instead"
          });
        }

        sendEvent("phase", { step: "complete", message: "Done!" });

      } catch (err: any) {
        console.error("Voice chat error:", err);
        sendEvent("phase", { 
          step: "error", 
          message: err.message || "Unknown error" 
        });
      } finally {
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
