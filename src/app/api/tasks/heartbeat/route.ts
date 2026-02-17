import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

/**
 * GET /api/tasks/heartbeat?agent=researcher
 *
 * Called by OpenClaw agents on each heartbeat via curl.
 * Returns the next ready task for this agent (pending + deps met).
 * If no task is ready, returns { hasTask: false }.
 */
export async function GET(request: NextRequest) {
  try {
    const agent = request.nextUrl.searchParams.get("agent");
    if (!agent) {
      return NextResponse.json(
        { error: "agent query parameter required" },
        { status: 400 }
      );
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!convexUrl) {
      return NextResponse.json(
        { error: "Convex URL not configured" },
        { status: 500 }
      );
    }

    const convex = new ConvexHttpClient(convexUrl);
    const convexAdminKey = process.env.CONVEX_ADMIN_KEY;
    if (convexAdminKey) {
      (convex as any).setAdminAuth(convexAdminKey);
    }

    // Mark stale running tasks as blocked (1-2 hour timeout)
    try {
      const allTasks = await convex.query(api.tasks.getTasks as any);
      const now = Date.now();
      const timeoutMs = 2 * 60 * 60 * 1000;
      for (const t of allTasks) {
        if (t.aiStatus === "running" && typeof t.aiStartedAt === "number") {
          if (now - t.aiStartedAt > timeoutMs) {
            await convex.mutation(api.tasks.updateAIProgress, {
              id: t._id,
              aiStatus: "blocked",
              aiProgress: t.aiProgress || 0,
              aiResponseShort: "Agent timed out after 2 hours",
              aiBlockers: ["heartbeat-timeout"],
            });
          }
        }
      }
    } catch (e) {
      console.log("Heartbeat timeout sweep failed (non-fatal):", e);
    }

    // Query Convex for ready heartbeat tasks for this agent
    const readyTasks = await convex.query(api.tasks.getHeartbeatTasks, {
      agent,
    });

    if (!readyTasks || readyTasks.length === 0) {
      return NextResponse.json({
        hasTask: false,
        agent,
        message: "No tasks ready. HEARTBEAT_OK.",
      });
    }

    // Return the first ready task (oldest first by createdAt)
    const sorted = [...readyTasks].sort(
      (a, b) => a.createdAt - b.createdAt
    );
    const task = sorted[0];

    // Mark task as running (best-effort, no locking)
    try {
      await convex.mutation(api.tasks.updateAIProgress, {
        id: task._id,
        aiStatus: "running",
        aiProgress: 5,
        aiResponseShort: `Picked up by ${agent}`,
      });
    } catch (e) {
      console.log("Heartbeat update error (non-fatal):", e);
    }

    return NextResponse.json({
      hasTask: true,
      agent,
      task: {
        id: task._id,
        title: task.title,
        description: task.description || "",
        priority: task.priority || "medium",
        parentTaskId: task.parentTaskId || null,
        subtaskMode: task.subtaskMode || null,
        dependsOn: task.dependsOn || [],
        tags: task.tags || [],
      },
      totalReady: sorted.length,
    });
  } catch (error: any) {
    console.error("Heartbeat query error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
