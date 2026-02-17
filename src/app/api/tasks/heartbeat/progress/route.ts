import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

/**
 * POST /api/tasks/heartbeat/progress
 * Agents call this to push progress updates while running a task.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, agent, progress, message } = body;

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    const convexAdminKey = process.env.CONVEX_ADMIN_KEY;
    if (convexAdminKey) {
      (convex as any).setAdminAuth(convexAdminKey);
    }

    const safeProgress = typeof progress === "number" ? Math.max(0, Math.min(progress, 99)) : 10;
    const responseShort = message ? String(message).slice(0, 200) : undefined;

    await convex.mutation(api.tasks.updateAIProgress, {
      id: taskId,
      aiStatus: "running",
      aiProgress: safeProgress,
      aiResponseShort: responseShort,
    });

    return NextResponse.json({ success: true, taskId });
  } catch (error: any) {
    console.error("Heartbeat progress error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
