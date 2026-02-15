import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@convex/_generated/api";
import { getOpenClawUrls } from "@/lib/openclaw";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, agent, taskId } = body;

    console.log("Executing AI task:", { title, agent, taskId });

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

    // Update task status to running (best effort via Convex)
    if (taskId && convex) {
      convexMutation(api.tasks.updateAIProgress, {
        id: taskId,
        aiStatus: "running",
        aiProgress: 10,
        aiResponseShort: "Task started...",
      }).catch(() => {});
    }

    // Fire and forget - process in background
    const openClawUrls = getOpenClawUrls();
    
    Promise.allSettled(
      openClawUrls.map(async (baseUrl) => {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.OPENCLAW_TOKEN && {
              "Authorization": `Bearer ${process.env.OPENCLAW_TOKEN}`
            }),
            "x-openclaw-agent-id": agent || "main",
          },
          body: JSON.stringify({
            model: "openclaw",
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(120000),
        });
        return { response, baseUrl };
      })
    ).then(async (results) => {
      for (const result of results) {
        if (result.status === "fulfilled" && result.value?.response?.ok) {
          const resultJson = await result.value.response.json();
          const assistantMessage = resultJson.choices?.[0]?.message?.content || "";
          console.log("OpenClaw response:", assistantMessage.slice(0, 100));
          
          if (taskId && convex) {
            convexMutation(api.tasks.updateAIProgress, {
              id: taskId,
              aiStatus: "completed",
              aiProgress: 100,
              aiResponse: assistantMessage,
              aiResponseShort: assistantMessage.slice(0, 200),
            }).catch(() => {});
          }
          return;
        }
      }
      
      // All failed
      if (convex && taskId) {
        convexMutation(api.tasks.updateAIProgress, {
          id: taskId,
          aiStatus: "blocked",
          aiProgress: 0,
          aiResponseShort: "OpenClaw execution failed",
          aiBlockers: ["All OpenClaw URLs failed"],
        }).catch(() => {});
      }
    }).catch(console.error);

    // Return immediately
    return NextResponse.json({
      success: true,
      status: "running",
      message: "Task started. Poll for completion.",
      taskId,
    });

  } catch (error: any) {
    console.error("Execute error:", error);
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
