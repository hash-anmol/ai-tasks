import { NextRequest, NextResponse } from "next/server";
import { getOpenClawUrls, getOpenClawAuth } from "@/lib/openclaw";

/**
 * POST /api/openclaw/chat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, agentId, sessionId, sessionKey } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Messages array required" },
        { status: 400 }
      );
    }

    const urls = getOpenClawUrls();
    let lastError: Error | null = null;

    for (const url of urls) {
      const { baseUrl, header } = getOpenClawAuth(url);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (header) {
          headers["Authorization"] = header;
        }
        if (agentId) {
          headers["x-openclaw-agent-id"] = agentId;
        }
        const effectiveSessionKey = sessionKey ?? sessionId;
        if (effectiveSessionKey) {
          headers["x-openclaw-session-key"] = effectiveSessionKey;
        }

        const upstreamRes = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: "openclaw",
            stream: true,
            messages: messages.map(
              (m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })
            ),
          }),
          signal: AbortSignal.timeout(300000),
        });

        if (!upstreamRes.ok) {
          const errText = await upstreamRes.text();
          console.error(`Chat error from ${baseUrl}:`, errText);
          lastError = new Error(errText || `HTTP ${upstreamRes.status}`);
          continue;
        }

        const encoder = new TextEncoder();
        const reader = upstreamRes.body!.getReader();
        const decoder = new TextDecoder();

        let contentBuffer = "";
        let thinkingBuffer = "";
        const toolCalls: any[] = [];
        const toolCallArgBuffers: Record<number, string> = {};

        const proxyStream = new ReadableStream({
          async start(controller) {
            function send(event: string, data: Record<string, unknown>) {
              controller.enqueue(
                encoder.encode(
                  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                )
              );
            }

            let sseBuffer = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });
                const lines = sseBuffer.split("\n");
                sseBuffer = lines.pop() || "";

                let dataAccum = "";
                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    dataAccum += line.slice(6);
                  } else if (line.trim() === "" && dataAccum) {
                    const dataStr = dataAccum.trim();
                    dataAccum = "";

                    if (dataStr === "[DONE]") {
                      send("done", {
                        content: contentBuffer,
                        toolCalls,
                        thinkingText: thinkingBuffer,
                      });
                      continue;
                    }

                    try {
                      const chunk = JSON.parse(dataStr);
                      const delta = chunk.choices?.[0]?.delta;
                      if (!delta) continue;

                      if (delta.content) {
                        contentBuffer += delta.content;
                        send("delta", { text: delta.content });
                      }

                      if (delta.reasoning_content) {
                        thinkingBuffer += delta.reasoning_content;
                        send("thinking", {
                          text: delta.reasoning_content,
                        });
                      }

                      if (delta.tool_calls && Array.isArray(delta.tool_calls)) {
                        for (const tc of delta.tool_calls) {
                          const idx = tc.index !== undefined ? tc.index : toolCalls.length;
                          if (tc.id && tc.function?.name) {
                            toolCallArgBuffers[idx] = tc.function.arguments || "";
                            toolCalls[idx] = { id: tc.id, name: tc.function.name, arguments: tc.function.arguments || "" };
                            send("tool_start", { id: tc.id, name: tc.function.name, arguments: tc.function.arguments || "", index: idx });
                          } else if (tc.function?.arguments) {
                            toolCallArgBuffers[idx] = (toolCallArgBuffers[idx] || "") + tc.function.arguments;
                            if (toolCalls[idx]) toolCalls[idx].arguments = toolCallArgBuffers[idx];
                          }
                        }
                      }

                      const finishReason = chunk.choices?.[0]?.finish_reason;
                      if (finishReason === "tool_calls" || finishReason === "stop") {
                        for (const tc of toolCalls) {
                          if (tc?.id && tc?.name) {
                            send("tool_end", { id: tc.id, name: tc.name, arguments: tc.arguments });
                          }
                        }
                      }
                    } catch {}
                  }
                }
              }
              send("done", { content: contentBuffer, toolCalls, thinkingText: thinkingBuffer });
            } catch (err: any) {
              send("error", { message: err.message });
            } finally {
              controller.close();
            }
          },
        });

        return new Response(proxyStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err: any) {
        console.error(`Chat error from ${baseUrl}:`, err.message);
        lastError = err;
        continue;
      }
    }

    return NextResponse.json({ error: lastError?.message || "All URLs failed" }, { status: 502 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  const urls = getOpenClawUrls();
  for (const url of urls) {
    const { baseUrl, header } = getOpenClawAuth(url);
    try {
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(header && { Authorization: header }),
        },
        body: JSON.stringify({
          model: "openclaw",
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return NextResponse.json({ connected: true, url: baseUrl });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ connected: false, urls });
}
