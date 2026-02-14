import { NextRequest, NextResponse } from "next/server";

const OPENCLAW_URL = process.env.NEXT_PUBLIC_OPENCLAW_URL || "http://homeserver:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Build the prompt for OpenClaw
    const prompt = description
      ? `Task: ${title}\n\nDescription: ${description}`
      : `Task: ${title}`;

    // Call OpenClaw to execute the task
    const openclawResponse = await fetch(`${OPENCLAW_URL}/api/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(OPENCLAW_TOKEN && { Authorization: `Bearer ${OPENCLAW_TOKEN}` }),
      },
      body: JSON.stringify({
        message: prompt,
        agent: agent || "main",
        sessionTarget: "isolated",
      }),
    });

    if (!openclawResponse.ok) {
      const error = await openclawResponse.text();
      return NextResponse.json(
        { error: `OpenClaw error: ${error}` },
        { status: 500 }
      );
    }

    const result = await openclawResponse.json();
    const sessionId = result.sessionId;

    return NextResponse.json({
      success: true,
      sessionId,
      message: "Task sent to OpenClaw agent",
    });
  } catch (error) {
    console.error("Execute error:", error);
    return NextResponse.json(
      { error: "Failed to execute task. Is OpenClaw reachable?" },
      { status: 500 }
    );
  }
}
