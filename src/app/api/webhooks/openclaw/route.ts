import { NextRequest, NextResponse } from "next/server";

/**
 * Webhook for OpenClaw to send results
 * Works without Convex - stores in memory/file for now
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, status, message, progress, response, taskId } = body;

    console.log("📥 OpenClaw webhook:", { sessionId, status, taskId });

    // Store webhook data (could be file, redis, etc.)
    // For now - just log and return success
    const webhookLog = {
      sessionId,
      status,
      message,
      progress,
      taskId,
      receivedAt: new Date().toISOString()
    };
    
    // TODO: Store in Convex when available
    // await ctx.db.insert("webhookLogs", webhookLog);

    return NextResponse.json({ success: true, received: webhookLog });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    service: "AI Tasks Webhook Handler",
    ready: true
  });
}
