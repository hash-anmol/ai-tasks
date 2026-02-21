import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

/**
 * POST /api/tasks/heartbeat/complete
 *
 * Called by agents when they finish a heartbeat-assigned task.
 * Updates the task status to completed and stores the response.
 * This is a backup path — the OpenClaw webhook also handles completion.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, response, agent } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId required" },
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

    const responseText = typeof response === "string" ? response : "";
    const responseShort = responseText ? responseText.slice(0, 200) : undefined;

    // Mark the task as completed
    await convex.mutation(api.tasks.updateAIProgress, {
      id: taskId,
      aiStatus: "completed",
      aiProgress: 100,
      aiResponse: responseText || undefined,
      aiResponseShort: responseShort,
    });

    // Update task status to review (not done — keep visible for user review)
    await convex.mutation(api.tasks.updateTaskStatus, {
      id: taskId,
      status: "review",
    });

    // Check if this was a subtask — update parent progress
    const task = await convex.query(api.tasks.getTask, { id: taskId });
    if (task?.parentTaskId) {
      await updateParentProgress(convex, task.parentTaskId);
    }

    // Create agent run record
    if (agent && responseText) {
      try {
        const runId = await convex.mutation(api.agentRuns.createAgentRun as any, {
          taskId,
          agent,
          prompt: task?.title || "Heartbeat task",
        });
        await convex.mutation(api.agentRuns.completeAgentRun as any, {
          id: runId,
          status: "completed",
          response: responseText,
          progress: 100,
        });
      } catch (e) {
        console.log("Agent run creation error (non-fatal):", e);
      }
    }

    return NextResponse.json({ success: true, taskId });
  } catch (error: any) {
    console.error("Heartbeat complete error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Check all subtasks of a parent and update parent progress.
 * If all subtasks are complete, mark parent as completed too.
 */
async function updateParentProgress(
  convex: ConvexHttpClient,
  parentTaskId: string
) {
  try {
    const subtasks = await convex.query(api.tasks.getSubtasks, {
      parentTaskId,
    });
    if (!subtasks || subtasks.length === 0) return;

    const completed = subtasks.filter(
      (t: any) => t.aiStatus === "completed"
    ).length;
    const total = subtasks.length;
    const progress = Math.round((completed / total) * 100);

    if (completed === total) {
      // All subtasks done — mark parent complete
      const responses = subtasks
        .filter((t: any) => t.aiResponse)
        .map(
          (t: any) =>
            `## ${t.title} (${t.agent || "unknown"})\n${t.aiResponse}`
        )
        .join("\n\n---\n\n");

      await convex.mutation(api.tasks.updateAIProgress, {
        id: parentTaskId as any,
        aiStatus: "completed",
        aiProgress: 100,
        aiResponse: responses || "All subtasks completed.",
        aiResponseShort: `All ${total} subtasks completed.`,
      });
      await convex.mutation(api.tasks.updateTaskStatus, {
        id: parentTaskId as any,
        status: "review",
      });
    } else {
      // Partial progress
      await convex.mutation(api.tasks.updateAIProgress, {
        id: parentTaskId as any,
        aiStatus: "running",
        aiProgress: progress,
        aiResponseShort: `${completed}/${total} subtasks completed.`,
      });
    }
  } catch (e) {
    console.error("Parent progress update error:", e);
  }
}
