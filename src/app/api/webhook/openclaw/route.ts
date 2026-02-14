import { NextResponse } from "next/server";

// POST /api/webhook/openclaw
// Receives task updates from OpenClaw agent

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.taskId && !body.openclawTaskId) {
      return NextResponse.json(
        { error: "taskId or openclawTaskId is required" },
        { status: 400 }
      );
    }

    // Process the webhook payload
    const update = {
      openclawTaskId: body.taskId || body.openclawTaskId,
      status: body.status, // "assigned", "working", "completed"
      progress: body.progress, // 0-100
      notes: body.notes, // AI notes about the task
      timestamp: new Date().toISOString(),
    };

    // In production, update Convex database
    // For now, return success and log
    console.log("OpenClaw webhook received:", update);

    return NextResponse.json({
      success: true,
      message: "Webhook received",
      received: update,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

// GET /api/webhook/openclaw
// Health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "OpenClaw webhook endpoint is running",
    endpoints: {
      POST: "Receive task updates from OpenClaw",
    },
  });
}
