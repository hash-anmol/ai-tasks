import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook for OpenClaw to send task results back to AI Tasks
 * 
 * OpenClaw should call this endpoint when:
 * - Task starts: status = "running"
 * - Progress update: status = "running", progress = X
 * - Task complete: status = "completed", response = "..."
 * - Task failed: status = "failed", response = "error message"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, status, message, progress, response, taskId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    console.log("Received webhook from OpenClaw:", {
      sessionId,
      status,
      message,
      progress,
      taskId,
    });

    // TODO: Store in Convex when it's set up
    // For now, just acknowledge receipt
    
    // Store in localStorage for demo (will be replaced with Convex)
    if (typeof window !== 'undefined') {
      const webhookData = JSON.parse(localStorage.getItem('openclaw-webhooks') || '[]');
      webhookData.push({
        sessionId,
        status,
        message,
        progress,
        response,
        taskId,
        receivedAt: Date.now(),
      });
      localStorage.setItem('openclaw-webhooks', JSON.stringify(webhookData));
    }

    return NextResponse.json({
      success: true,
      message: "Webhook received",
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}

// Handle GET for health check
export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "AI Tasks Webhook",
  });
}
