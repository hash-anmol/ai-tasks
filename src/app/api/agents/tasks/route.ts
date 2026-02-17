import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexAdminKey = process.env.CONVEX_ADMIN_KEY;

function getConvex() {
  if (!convexUrl) {
    throw new Error("Convex URL not configured");
  }
  const convex = new ConvexHttpClient(convexUrl);
  if (convexAdminKey) {
    (convex as any).setAdminAuth(convexAdminKey);
  }
  return convex;
}

function areDependenciesMet(
  taskDependsOn: string[] | undefined,
  allTasks: any[]
): boolean {
  if (!taskDependsOn || taskDependsOn.length === 0) return true;
  return taskDependsOn.every((depId) => {
    const depTask = allTasks.find((t) => t._id === depId);
    return depTask?.aiStatus === "completed";
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agent = searchParams.get("agent");
    const status = searchParams.get("status");
    const parentTaskId = searchParams.get("parentTaskId");

    if (!agent) {
      return NextResponse.json({ error: "agent parameter required" }, { status: 400 });
    }

    const convex = getConvex();
    const allTasks = await convex.query(api.tasks.getTasks as any);

    let filteredTasks = allTasks.filter((t: any) => {
      // Match agent
      if (t.agent !== agent) return false;

      // Match status if provided
      if (status && t.aiStatus !== status) return false;

      // Match parent task if provided
      if (parentTaskId && t.parentTaskId !== parentTaskId) return false;

      return true;
    });

    // Filter: only pending tasks where dependencies are met
    // Or running tasks that were claimed by this agent
    const availableTasks = filteredTasks.filter((t: any) => {
      if (t.aiStatus === "pending") {
        return areDependenciesMet(t.dependsOn, allTasks);
      }
      // Include running tasks (already claimed)
      if (t.aiStatus === "running") {
        return true;
      }
      return false;
    });

    // Sort by createdAt (oldest first)
    availableTasks.sort((a: any, b: any) => a.createdAt - b.createdAt);

    return NextResponse.json({
      tasks: availableTasks,
      count: availableTasks.length,
    });
  } catch (error: any) {
    console.error("Agent tasks GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentTaskId, tasks, subtaskMode } = body;

    if (!parentTaskId || !Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json(
        { error: "parentTaskId and tasks array required" },
        { status: 400 }
      );
    }

    const convex = getConvex();
    const createdIds: string[] = [];

    for (const task of tasks) {
      const id = await convex.mutation(api.tasks.createTask as any, {
        title: task.title,
        description: task.description || undefined,
        status: "assigned",
        priority: task.priority || "medium",
        dueDate: task.dueDate || undefined,
        tags: task.tags || [],
        isAI: true,
        agent: task.agent,
        dependsOn: task.dependsOn || undefined,
        parentTaskId,
        isSubtask: true,
        createdBy: "coordinator",
        subtaskMode: subtaskMode || "parallel",
        heartbeatAgentId: task.agent,
      });
      createdIds.push(String(id));
    }

    return NextResponse.json({ success: true, createdIds });
  } catch (error: any) {
    console.error("Agent tasks POST error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create subtasks" },
      { status: 500 }
    );
  }
}
