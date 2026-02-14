import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { fetchAction } from "convex/nextjs";

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

    // Find task by sessionId and update it
    if (taskId) {
      // Update the task with AI progress
      try {
        await fetchAction(api.tasks.updateAIProgress, {
          id: taskId,
          aiStatus: status,
          aiProgress: progress || 0,
          aiResponse: response || message,
          aiResponseShort: response?.substring(0, 200) || message?.substring(0, 200),
        });
      } catch (convexError) {
        console.error("Convex update error:", convexError);
      }
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
