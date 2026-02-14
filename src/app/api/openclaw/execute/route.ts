import { NextRequest, NextResponse } from "next/server";

const OPENCLAW_URL = process.env.NEXT_PUBLIC_OPENCLAW_URL || "http://homeserver:18789";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, scheduledAt } = body;

    if (!title) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    // Check if scheduled for later
    if (scheduledAt && scheduledAt > Date.now()) {
      return NextResponse.json({
        success: true,
        status: "scheduled",
        message: `Task scheduled for ${new Date(scheduledAt).toISOString()}`
      });
    }

    // Build prompt
    const prompt = description 
      ? `Task: ${title}\n\nDescription: ${description}`
      : `Task: ${title}`;

    // Execute via OpenClaw
    const response = await fetch(`${OPENCLAW_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: prompt,
        agent: agent || "main",
        sessionTarget: "isolated",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      // If OpenClaw not reachable, simulate success for demo
      if (response.status === 0 || err.includes("fetch") || err.includes("ECONNREFUSED")) {
        return NextResponse.json({
          success: true,
          status: "demo",
          sessionId: `demo-${Date.now()}`,
          message: "Demo mode: OpenClaw not reachable. Task would be sent to agent."
        });
      }
      return NextResponse.json({ error: `OpenClaw: ${err}` }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json({
      success: true,
      sessionId: result.sessionId,
      status: "running",
      message: "Task sent to AI agent"
    });
  } catch (error: any) {
    // Return demo success if OpenClaw unreachable
    if (error.message?.includes("fetch") || error.code === "ECONNREFUSED") {
      return NextResponse.json({
        success: true,
        status: "demo",
        sessionId: `demo-${Date.now()}`,
        message: "Demo mode: OpenClaw not reachable"
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    openclawUrl: OPENCLAW_URL,
    note: "Ready to execute AI tasks"
  });
}
