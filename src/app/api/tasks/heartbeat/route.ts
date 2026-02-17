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
