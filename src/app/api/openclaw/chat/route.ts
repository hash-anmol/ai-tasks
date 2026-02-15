import { NextRequest, NextResponse } from "next/server";
import { getOpenClawUrls } from "@/lib/openclaw";

const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;

/**
 * POST /api/openclaw/chat
 * Body: { messages: Array<{role: string, content: string}> }
 * 
 * Uses the OpenAI-compatible /v1/chat/completions endpoint
 * which the OpenClaw gateway supports.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const urls = getOpenClawUrls();
    let lastError: Error | null = null;

    for (const baseUrl of urls) {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (OPENCLAW_TOKEN) {
          headers["Authorization"] = `Bearer ${OPENCLAW_TOKEN}`;
        }

        const res = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: "openclaw",
            messages: messages.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: AbortSignal.timeout(120000), // 2 minute timeout
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Chat error from ${baseUrl}:`, errText);
          lastError = new Error(errText || `HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const assistantMessage = data.choices?.[0]?.message?.content || "";

        return NextResponse.json({
          role: "assistant",
          content: assistantMessage,
        });
      } catch (err: any) {
        console.error(`Chat error from ${baseUrl}:`, err.message);
        lastError = err;
        continue;
      }
    }

    return NextResponse.json(
      { error: lastError?.message || "All OpenClaw URLs failed" },
      { status: 502 }
    );
  } catch (error: any) {
    console.error("Chat error:", error);
    return NextResponse.json({ error: error.message || "Chat failed" }, { status: 500 });
  }
}

/**
 * GET /api/openclaw/chat
 * Health check - tests connectivity to OpenClaw
 */
export async function GET() {
  const urls = getOpenClawUrls();
  for (const baseUrl of urls) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (OPENCLAW_TOKEN) {
        headers["Authorization"] = `Bearer ${OPENCLAW_TOKEN}`;
      }
      const res = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "openclaw",
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return NextResponse.json({ connected: true, url: baseUrl });
      }
    } catch {
      continue;
    }
  }
  return NextResponse.json({ connected: false, urls });
}
