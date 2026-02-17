import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getOpenClawUrls } from "@/lib/openclaw";
import { logOpenClaw } from "@/lib/openclawLogger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId, sessionId: existingSessionId } = body;

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

    const convexMutation = async (fn: any, args: any) => {
      if (!convex) return;
      try {
        await convex.mutation(fn, args);
      } catch (e) {
        console.log("Convex mutation error:", e);
      }
    };

    // Update task status to running (best effort via Convex or direct)
    if (taskId && convex) {
      convexMutation(api.tasks.updateAIProgress, {
        id: taskId,
        aiStatus: "running",
        aiProgress: 10,
        aiResponseShort: "Task started...",
      }).catch(() => {});

      // If reusing an existing session, link it to the task
      if (existingSessionId) {
        convexMutation(api.tasks.updateTask, {
          id: taskId,
          openclawSessionId: existingSessionId,
        }).catch(() => {});
      }
    }
    
    // Also update in-memory store directly
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://ai-tasks-zeta.vercel.app'}/api/tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, aiStatus: "running", aiProgress: 10 }),
      });
    } catch (e) {
      console.log("Direct update failed:", e);
    }

    // Fire and forget - process in background (no waiting, Vercel has 60s timeout)
    // OpenClaw will call webhook with progress updates
    const openClawUrls = getOpenClawUrls();
    
    // Just fire the request - don't wait for response
    // OpenClaw gateway will call our webhook with updates
    for (const baseUrl of openClawUrls) {
      logOpenClaw("info", "execute.dispatch", "Dispatch to OpenClaw (fire-and-forget)", {
        baseUrl,
        agent: agent || "main",
        taskId: taskId || null,
        sessionId: existingSessionId || null,
      }).catch(() => {});
      
      const openClawToken = process.env.OPENCLAW_TOKEN || process.env.OPENCLAW_PASSWORD || process.env.OPENCLAW_GATEWAY_PASSWORD;
      
      fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(openClawToken && {
            "Authorization": `Bearer ${openClawToken}`
          }),
          "x-openclaw-agent-id": agent || "main",
          ...(existingSessionId && {
            "x-openclaw-session-id": existingSessionId
          }),
        },
        body: JSON.stringify({
          model: "openclaw",
          messages: [{ role: "user", content: prompt }],
        }),
      }).catch(async (err) => {
        await logOpenClaw("error", "execute.dispatch.error", "Dispatch failed", {
          baseUrl,
          agent: agent || "main",
          taskId: taskId || null,
          error: String(err),
        });
      });
    }

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
    openclawUrl: getOpenClawUrls(),
    ready: true
  });
}
