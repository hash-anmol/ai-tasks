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

    const taskId = body.taskId || body.openclawTaskId;
    
    // Get existing tasks from localStorage (in client-side only)
    // For server-side, we'll return the update info and client can apply it
    
    // Process the webhook payload
    const update = {
      openclawTaskId: taskId,
      status: body.status || body.aiStatus, // "assigned", "working", "completed"
      progress: body.progress || body.aiProgress, // 0-100
      notes: body.notes || body.aiNotes, // AI notes about the task
      timestamp: new Date().toISOString(),
    };

    console.log("OpenClaw webhook received:", update);

    // Return the update so client can apply it
    // Client should listen for this and update localStorage
    return NextResponse.json({
      success: true,
      message: "Webhook received",
      received: update,
      clientAction: {
        type: "UPDATE_TASK",
        taskId: taskId,
        update: {
          aiStatus: update.status,
          aiProgress: update.progress,
          aiNotes: update.notes,
          openclawTaskId: update.openclawTaskId,
        }
      }
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
