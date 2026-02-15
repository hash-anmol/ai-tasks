import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, status, message, progress, response, taskId, blockers, agent, prompt } = body;

    console.log("📥 OpenClaw webhook:", { sessionId, status, taskId });

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

    return NextResponse.json({ success: true });
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
