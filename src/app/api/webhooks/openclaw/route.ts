import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, status, message, progress, response, taskId, blockers, agent, prompt } = body;

    console.log("OpenClaw webhook:", { sessionId, status, taskId });

    if (!taskId) {
      return NextResponse.json({ error: "taskId required" }, { status: 400 });
    }

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const convexAdminKey = process.env.CONVEX_ADMIN_KEY;
    if (!convexUrl) {
      return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
    }

    const convex = new ConvexHttpClient(convexUrl);
    if (convexAdminKey) {
      (convex as any).setAdminAuth(convexAdminKey);
    }
    const convexMutation = async <T>(fn: T, args: Record<string, unknown>) => {
      await convex.mutation(fn as any, args, { skipQueue: true } as any);
    };

    const normalizedStatus = typeof status === "string" ? status : "running";
    const normalizedProgress = typeof progress === "number" ? progress : 0;
    const responseText = typeof response === "string" ? response : message ? String(message) : "";
    const responseShort = responseText ? responseText.slice(0, 200) : undefined;
    const blockerList = Array.isArray(blockers)
      ? blockers.map((entry) => String(entry))
      : normalizedStatus === "blocked" && responseText
      ? [responseText]
      : undefined;

    await convexMutation(api.tasks.updateAIProgress, {
      id: taskId,
      aiStatus: normalizedStatus,
      aiProgress: normalizedProgress,
      aiResponse: responseText || undefined,
      aiResponseShort: responseShort,
      aiBlockers: blockerList,
    });

    if (sessionId) {
      await convexMutation(api.tasks.updateTask, {
        id: taskId,
        openclawSessionId: String(sessionId),
      });

      // Upsert session record for session picker
      try {
        const task = await convex.query(api.tasks.getTask as any, { id: taskId });
        const sessionName = task?.title || prompt || "Untitled Session";
        const sessionAgent = agent || task?.agent || "unknown";
        const sessionStatus = normalizedStatus === "completed" ? "completed"
          : normalizedStatus === "failed" ? "failed"
          : "active";
        await convexMutation(api.sessions.upsertSession, {
          sessionId: String(sessionId),
          name: sessionName,
          agent: sessionAgent,
          status: sessionStatus,
          lastTaskId: String(taskId),
          lastTaskTitle: task?.title || sessionName,
        });
      } catch (e) {
        console.log("Session upsert error (non-fatal):", e);
      }
    }

    const runAgent = agent || "unknown";
    if (prompt || responseText) {
      const runId = await convex.mutation(api.agentRuns.createAgentRun as any, {
        taskId,
        agent: runAgent,
        prompt: prompt || responseText || "",
      }, { skipQueue: true } as any);
      await convexMutation(api.agentRuns.completeAgentRun, {
        id: runId,
        status: normalizedStatus,
        response: responseText || "",
        progress: normalizedProgress,
        blockers: blockerList,
      });
    }

    // --- Multi-agent: check parent task progress on subtask completion ---
    if (normalizedStatus === "completed" || normalizedStatus === "failed") {
      try {
        const task = await convex.query(api.tasks.getTask as any, { id: taskId });
        if (task?.parentTaskId) {
          await updateParentProgress(convex, task.parentTaskId);
        }
      } catch (e) {
        console.log("Parent progress check error (non-fatal):", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Check all subtasks of a parent and update parent progress.
 * If all subtasks are complete, mark parent as completed.
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
    const failed = subtasks.filter(
      (t: any) => t.aiStatus === "failed"
    ).length;
    const total = subtasks.length;
    const progress = Math.round((completed / total) * 100);

    if (completed + failed === total) {
      // All subtasks finished
      const responses = subtasks
        .filter((t: any) => t.aiResponse)
        .map(
          (t: any) =>
            `## ${t.title} (${t.agent || "unknown"}) - ${t.aiStatus}\n${t.aiResponse}`
        )
        .join("\n\n---\n\n");

      const finalStatus = failed > 0 ? "completed" : "completed"; // still complete even with some failures
      const summary = failed > 0
        ? `${completed}/${total} subtasks completed, ${failed} failed.`
        : `All ${total} subtasks completed.`;

      await convex.mutation(api.tasks.updateAIProgress as any, {
        id: parentTaskId,
        aiStatus: finalStatus,
        aiProgress: 100,
        aiResponse: responses || summary,
        aiResponseShort: summary,
      }, { skipQueue: true } as any);
      await convex.mutation(api.tasks.updateTaskStatus as any, {
        id: parentTaskId,
        status: "done",
      }, { skipQueue: true } as any);
    } else {
      // Partial progress — update parent to show running state
      await convex.mutation(api.tasks.updateAIProgress as any, {
        id: parentTaskId,
        aiStatus: "running",
        aiProgress: progress,
        aiResponseShort: `${completed}/${total} subtasks completed.`,
      }, { skipQueue: true } as any);
    }
  } catch (e) {
    console.error("Parent progress update error:", e);
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    service: "AI Tasks Webhook Handler",
    ready: true
  });
}
