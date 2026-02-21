import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getOpenClawUrls, getOpenClawAuth } from "@/lib/openclaw";
import { logOpenClaw } from "@/lib/openclawLogger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId, sessionId: existingSessionId, model: requestedModel } = body;

    // Model selection: support easy switching between providers
    // Default to google/gemini-3-flash-preview (was working)
    // Set OPENCLAW_DEFAULT_MODEL env var to switch (e.g., "minimax/MiniMax-M2.5")
    const DEFAULT_MODEL = process.env.OPENCLAW_DEFAULT_MODEL || "google/gemini-3-flash-preview";
    const model = requestedModel || DEFAULT_MODEL;

    // Convert string taskId to Convex Id
    const convexTaskId = taskId ? taskId as any : null;

    console.log("Executing AI task:", { title, agent, taskId });
    await logOpenClaw("info", "execute.request", "Execute AI task", {
      title: String(title || ""),
      agent: agent || "main",
      taskId: taskId || null,
      sessionId: existingSessionId || null,
    });

    const trimmedTitle = String(title).trim();
    if (!trimmedTitle) {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }
    const trimmedDescription = description ? String(description).trim() : "";
    const prompt = trimmedDescription
      ? `Task: ${trimmedTitle}\n\nDescription: ${trimmedDescription}`
      : `Task: ${trimmedTitle}`;
    // Gateway stores sessions as "agent:{agentId}:task:{taskId}" — match that format
    // so the polling loop can find the session by key.
    const agentId = agent || "main";
    const sessionKey = taskId ? `agent:${agentId}:task:${taskId}` : undefined;

    // Setup Convex (optional - won't fail if unavailable)
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    let convex: ConvexHttpClient | null = null;
    try {
      if (convexUrl) {
        convex = new ConvexHttpClient(convexUrl);
      }
    } catch (e) {
      console.log("Convex not available:", e);
    }

    if (convex) {
      const convexAdminKey = process.env.CONVEX_ADMIN_KEY;
      if (convexAdminKey) {
        (convex as any).setAdminAuth(convexAdminKey);
      }
    }

    const convexMutation = async (fn: any, args: any) => {
      if (!convex) {
        console.log("[CONVEX] Skipping mutation - convex is null");
        return;
      }
      try {
        console.log("[CONVEX] Calling mutation:", fn.name || fn, "with args:", JSON.stringify(args));
        const result = await convex.mutation(fn, args, { skipQueue: true } as any);
        console.log("[CONVEX] Mutation success:", fn.name || fn, "result:", result);
        return result;
      } catch (e: any) {
        console.log("[CONVEX] Mutation error:", fn.name || fn, "error:", e?.message || e);
        throw e;
      }
    };

    // Update task status to running (best effort via Convex or direct)
    if (taskId && convex && convexTaskId) {
      convexMutation(api.tasks.updateAIProgress, {
        id: convexTaskId,
        aiStatus: "running",
        aiProgress: 10,
        aiResponseShort: "Task started...",
      }).catch(() => {});

      if (sessionKey) {
        convexMutation(api.tasks.updateTask, {
          id: convexTaskId,
          openclawSessionId: sessionKey,
          openclawTaskId: taskId,
        }).catch(() => {});
      }

      // If reusing an existing session, link it to the task
      if (existingSessionId) {
        convexMutation(api.tasks.updateTask, {
          id: convexTaskId,
          openclawSessionId: existingSessionId,
        }).catch(() => {});
      }
    }
    
    // Background dispatch: try each URL in order, stop at first success.
    // Only mark failed in Convex if ALL URLs fail.
    const openClawUrls = getOpenClawUrls();
    
    console.log("[EXECUTE] Task dispatch details:", {
      urls: openClawUrls,
      agent,
      taskId,
      model,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 100),
      sessionKey,
    });
    
    await logOpenClaw("info", "execute.dispatch.start", "Starting task dispatch to OpenClaw", {
      urls: openClawUrls,
      agent: agent || "main",
      model: model,
      taskId: taskId || null,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 200),
      sessionKey: sessionKey || null,
    });

    // Run dispatch in background — return immediately to client
    (async () => {
      let dispatched = false;
      const errors: string[] = [];

      for (const url of openClawUrls) {
        const { baseUrl, header, token } = getOpenClawAuth(url);

        console.log("[EXECUTE] Dispatching to URL:", {
          baseUrl,
          hasAuth: !!header,
          tokenPreview: token ? token.slice(0, 20) + "..." : "none",
          agent: agent || "main",
          model: model,
          taskId,
          sessionKey,
        });

        await logOpenClaw("info", "execute.dispatch", "Dispatch to OpenClaw", {
          baseUrl,
          hasAuth: !!header,
          agent: agent || "main",
          taskId: taskId || null,
          sessionKey: sessionKey || null,
        }).catch(() => {});

        try {
          const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(header && { "Authorization": header }),
              "x-openclaw-agent-id": agent || "main",
              ...(existingSessionId && { "x-openclaw-session-id": existingSessionId }),
              ...(sessionKey && { "x-openclaw-session-key": sessionKey }),
              ...(taskId && { "x-openclaw-task-id": taskId }),
            },
            body: JSON.stringify({
              model: model,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          const responseText = await response.text();
          console.log("[EXECUTE] OpenClaw response:", {
            baseUrl,
            status: response.status,
            statusText: response.statusText,
            bodyPreview: responseText.slice(0, 500),
          });

          await logOpenClaw("info", "execute.dispatch.response", "OpenClaw response received", {
            baseUrl,
            status: response.status,
            statusText: response.statusText,
            bodyPreview: responseText.slice(0, 500),
            taskId: taskId || null,
          }).catch(() => {});

          if (response.ok && taskId && convexTaskId) {
            dispatched = true;
            console.log("[EXECUTE] Response OK, attempting to save to Convex. taskId:", taskId);
            try {
              const parsed = JSON.parse(responseText);
              const content = parsed?.choices?.[0]?.message?.content;
              const responseBody = typeof content === "string" ? content : "";
              const responseShort = responseBody ? responseBody.slice(0, 200) : undefined;

              if (responseBody) {
                await convexMutation(api.tasks.updateAIProgress, {
                  id: convexTaskId,
                  aiStatus: "completed",
                  aiProgress: 100,
                  aiResponse: responseBody,
                  aiResponseShort: responseShort,
                });
                await convexMutation(api.tasks.updateTaskStatus, {
                  id: convexTaskId,
                  status: "review",
                });

                const runId = await convex?.mutation(api.agentRuns.createAgentRun as any, {
                  taskId,
                  agent: agent || "main",
                  prompt,
                }, { skipQueue: true } as any);
                if (runId) {
                  await convexMutation(api.agentRuns.completeAgentRun, {
                    id: runId,
                    status: "completed",
                    response: responseBody,
                    progress: 100,
                  });
                }
                console.log("[EXECUTE] All Convex updates complete!");
              } else {
                console.log("[EXECUTE] WARNING: responseBody is empty");
              }
            } catch (err: any) {
              console.log("[EXECUTE] Response parse/store error:", err?.message || err);
            }
            break; // Stop trying other URLs on success
          } else {
            const reason = response.status === 401
              ? `401 Unauthorized — check OPENCLAW_TOKEN`
              : `${response.status} ${response.statusText}`;
            errors.push(`${baseUrl}: ${reason}`);
            console.log("[EXECUTE] URL failed:", baseUrl, reason);
          }
        } catch (err: any) {
          const reason = err?.message || String(err);
          errors.push(`${baseUrl}: ${reason}`);
          console.log("[EXECUTE] Dispatch error:", { baseUrl, error: reason });
          await logOpenClaw("error", "execute.dispatch.error", "Dispatch failed", {
            baseUrl,
            agent: agent || "main",
            taskId: taskId || null,
            error: reason,
          }).catch(() => {});
        }
      }

      // If no URL succeeded, mark the task as failed
      if (!dispatched && taskId && convexTaskId && convex) {
        const failReason = errors.length > 0
          ? errors[0]
          : "OpenClaw unreachable";
        console.log("[EXECUTE] All URLs failed — marking task as failed:", failReason);
        convexMutation(api.tasks.updateAIProgress, {
          id: convexTaskId,
          aiStatus: "failed",
          aiProgress: 0,
          aiResponseShort: failReason,
        }).catch(() => {});
      }
    })().catch((err) => {
      console.log("[EXECUTE] Background dispatch error:", err?.message || err);
    });

    // Return immediately
    return NextResponse.json({
      success: true,
      status: "running",
      message: "Task started. Poll for completion.",
      taskId,
      sessionId: existingSessionId || undefined,
    });

  } catch (error: any) {
    console.error("Execute error:", error);
    await logOpenClaw("error", "execute.error", "Execute endpoint error", {
      message: error?.message || String(error),
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    openclawUrls: getOpenClawUrls(),
    ready: true
  });
}
