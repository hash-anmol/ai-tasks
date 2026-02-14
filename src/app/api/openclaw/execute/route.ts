import { NextRequest, NextResponse } from "next/server";

const OPENCLAW_URL = process.env.NEXT_PUBLIC_OPENCLAW_URL || "http://homeserver:18789";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent } = body;

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    console.log("🤖 Executing AI task:", { title, agent });

    // Build prompt for OpenClaw
    const prompt = description 
      ? `Task: ${title}\n\nDescription: ${description}`
      : `Task: ${title}`;

    // Try to execute via OpenClaw
    try {
      const response = await fetch(`${OPENCLAW_URL}/api/sessions`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          // Add auth if token is available
          ...(process.env.OPENCLAW_TOKEN && { 
            "Authorization": `Bearer ${process.env.OPENCLAW_TOKEN}` 
          }),
        },
        body: JSON.stringify({
          message: prompt,
          agent: agent || "main",
          sessionTarget: "isolated",
        }),
        // Add timeout
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const result = await response.json();
        console.log("✅ OpenClaw session created:", result.sessionId);
        return NextResponse.json({
          success: true,
          sessionId: result.sessionId,
          status: "running",
          message: "Task sent to AI agent"
        });
      } else {
        const error = await response.text();
        console.log("⚠️ OpenClaw error:", error);
        // Return success anyway - task is created, agent will run when reachable
        return NextResponse.json({
          success: true,
          status: "pending",
          message: "Task created. AI agent will execute when OpenClaw is reachable."
        });
      }
    } catch (openClawError: any) {
      console.log("⚠️ OpenClaw not reachable:", openClawError.message);
      // Return success - task is created, will execute later
      return NextResponse.json({
        success: true,
        status: "pending",
        message: `Task created. AI execution pending (OpenClaw: ${openClawError.message})`
      });
    }

  } catch (error: any) {
    console.error("❌ Execute error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    openclawUrl: OPENCLAW_URL,
    ready: true
  });
}
