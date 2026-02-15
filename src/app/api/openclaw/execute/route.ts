import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getOpenClawUrls } from "@/lib/openclaw";

const OPENCLAW_URLS = getOpenClawUrls();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId } = body;

    console.log("🤖 Executing AI task:", { title, agent, taskId });

    // Build prompt for OpenClaw
    const trimmedTitle = String(title).trim();
    if (!trimmedTitle) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    const trimmedDescription = description ? String(description).trim() : "";
    const prompt = trimmedDescription
      ? `Task: ${trimmedTitle}\n\nDescription: ${trimmedDescription}`
      : `Task: ${trimmedTitle}`;

    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    const convexAdminKey = process.env.CONVEX_ADMIN_KEY;
    const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;
    if (convex && convexAdminKey) {
      (convex as any).setAdminAuth(convexAdminKey);
    }
    const convexMutation = async <T>(fn: T, args: Record<string, unknown>) => {
      if (!convex) return;
      await convex.mutation(fn as any, args, { skipQueue: true } as any);
    };

    let runId: string | undefined;
    if (convex && taskId) {
      runId = await convex.mutation(api.agentRuns.createAgentRun as any, {
        taskId,
        agent: agent || "main",
        prompt,
      }, { skipQueue: true } as any);
    }

    // Try to execute via OpenClaw
    try {
      let response: Response | null = null;
      let lastError: Error | null = null;
      let resolvedUrl: string | null = null;

      for (const baseUrl of getOpenClawUrls()) {
        try {
          response = await fetch(`${baseUrl}/api/sessions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(process.env.OPENCLAW_TOKEN && {
                "Authorization": `Bearer ${process.env.OPENCLAW_TOKEN}`
              }),
            },
            body: JSON.stringify({
              message: prompt,
              agent: agent || "main",
              sessionTarget: "isolated",
              metadata: { taskId },
            }),
            signal: AbortSignal.timeout(10000),
          });
          resolvedUrl = baseUrl;
          break;
        } catch (error) {
          lastError = error as Error;
        }
      }

      if (!response) {
        throw lastError || new Error("OpenClaw not reachable");
      }

      if (response.ok) {
        const result = await response.json();
        console.log("✅ OpenClaw session created:", result.sessionId);
        if (convex && taskId) {
          await convexMutation(api.tasks.linkOpenClawSession, {
            id: taskId,
            openclawSessionId: result.sessionId,
            openclawTaskId: result.taskId,
            aiStatus: "running",
          });
          if (runId) {
            await convexMutation(api.agentRuns.updateAgentRun, {
              id: runId,
              status: "running",
            });
          }
        }
        return NextResponse.json({
          success: true,
          sessionId: result.sessionId,
          status: "running",
          message: "Task sent to AI agent",
        });
      } else {
        const error = await response.text();
        console.log("⚠️ OpenClaw error:", error);
        if (convex && taskId) {
          await convexMutation(api.tasks.updateAIProgress, {
            id: taskId,
            aiStatus: "blocked",
            aiProgress: 0,
            aiResponseShort: "OpenClaw not reachable. Check public URL.",
            aiBlockers: [
              `OpenClaw error from ${resolvedUrl || "unknown"}: ${error || "fetch failed"}`,
            ],
          });
          if (runId) {
            await convexMutation(api.agentRuns.updateAgentRun, {
              id: runId,
              status: "blocked",
            });
          }
        }
        // Return success anyway - task is created, agent will run when reachable
        return NextResponse.json({
          success: true,
          status: "blocked",
          message: "Task created. AI agent blocked (OpenClaw not reachable)."
        });
      }
    } catch (openClawError: any) {
      console.log("⚠️ OpenClaw not reachable:", openClawError.message);
      if (convex && taskId) {
        await convexMutation(api.tasks.updateAIProgress, {
          id: taskId,
          aiStatus: "blocked",
          aiProgress: 0,
          aiResponseShort: `OpenClaw not reachable: ${openClawError.message}`,
          aiBlockers: [
            `OpenClaw not reachable. Set NEXT_PUBLIC_OPENCLAW_URL to a public URL.`,
          ],
        });
        if (runId) {
          await convexMutation(api.agentRuns.updateAgentRun, {
            id: runId,
            status: "blocked",
          });
        }
      }
      // Return success - task is created, will execute later
      return NextResponse.json({
        success: true,
        status: "blocked",
        message: `Task created. AI blocked (OpenClaw: ${openClawError.message})`
      });
    }

  } catch (error: any) {
    console.error("❌ Execute error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    openclawUrl: OPENCLAW_URLS,
    ready: true
  });
}
