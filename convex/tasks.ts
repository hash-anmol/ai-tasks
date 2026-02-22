import { query, mutation, internalMutation, action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";

// --- OpenClaw Helpers (ported from src/lib/openclaw.ts) ---

function getAuthFromUrl(urlStr: string) {
  let workingUrl = urlStr.trim();
  if (!workingUrl.startsWith("http://") && !workingUrl.startsWith("https://")) {
    workingUrl = "https://" + workingUrl;
  }
  try {
    const url = new URL(workingUrl);
    const token = url.searchParams.get("token");
    const password = url.searchParams.get("password");
    url.search = "";
    const cleanUrl = url.toString().replace(/\/$/, "");
    return { token: token || undefined, password: password || undefined, cleanUrl };
  } catch {
    return { cleanUrl: urlStr.split("?")[0].replace(/\/$/, "") };
  }
}

function getOpenClawUrls() {
  const primary = process.env.OPENCLAW_URL || process.env.NEXT_PUBLIC_OPENCLAW_URL;
  const fallbacks = process.env.OPENCLAW_FALLBACK_URLS ? process.env.OPENCLAW_FALLBACK_URLS.split(",") : [];
  const all = [];
  if (primary) all.push(primary);
  all.push(...fallbacks);
  
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const url of all) {
    const trimmed = url.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      normalized.push(trimmed);
    }
  }
  return normalized;
}

function getOpenClawAuth(baseUrl: string) {
  const urlAuth = getAuthFromUrl(baseUrl);
  const token = urlAuth.token || process.env.OPENCLAW_TOKEN;
  const password = urlAuth.password || process.env.OPENCLAW_PASSWORD || process.env.OPENCLAW_GATEWAY_PASSWORD;
  const authCredential = (password || token)?.trim();
  return {
    baseUrl: urlAuth.cleanUrl,
    header: authCredential ? `Bearer ${authCredential}` : undefined
  };
}

// --- Convex Functions ---

// Get all tasks
export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

// Get tasks by status
export const getTasksByStatus = query({
  args: { status: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("status"), args.status))
      .collect();
  },
});

// Get AI tasks
export const getAITasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("isAI"), true))
      .collect();
  },
});

// Get tasks by agent
export const getTasksByAgent = query({
  args: { agent: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("agent"), args.agent))
      .collect();
  },
});

// Get single task
export const getTask = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get subtasks for a parent task
export const getSubtasks = query({
  args: { parentTaskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("parentTaskId"), args.parentTaskId))
      .collect();
  },
});

// Get ready heartbeat tasks for a specific agent
// Returns tasks where: heartbeatAgentId matches, aiStatus=pending, all dependsOn are completed
export const getHeartbeatTasks = query({
  args: { agent: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Get all pending tasks assigned to this agent via heartbeat
    const candidates = await ctx.db
      .query("tasks")
      .filter((q) =>
        q.and(
          q.eq(q.field("heartbeatAgentId"), args.agent),
          q.eq(q.field("aiStatus"), "assigned")
        )
      )
      .collect();

    // Filter out tasks whose dependencies aren't all completed
    const readyTasks = [];
    for (const task of candidates) {
      if (typeof task.scheduledAt === "number" && task.scheduledAt > now) {
        continue;
      }
      if (!task.dependsOn || task.dependsOn.length === 0) {
        readyTasks.push(task);
        continue;
      }
      // Check all dependencies are completed
      let allDepsComplete = true;
      for (const depId of task.dependsOn) {
        try {
          const depTask = await ctx.db.get(depId as any) as any;
          if (!depTask || depTask.aiStatus !== "completed") {
            allDepsComplete = false;
            break;
          }
        } catch {
          // If dep can't be found, treat as unmet
          allDepsComplete = false;
          break;
        }
      }
      if (allDepsComplete) {
        readyTasks.push(task);
      }
    }
    return readyTasks;
  },
});

// Create task
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    tags: v.array(v.string()),
    isAI: v.boolean(),
    agent: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    dependsOn: v.optional(v.array(v.string())),
    parentTaskId: v.optional(v.string()),
    isSubtask: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
    subtaskMode: v.optional(v.string()),
    heartbeatAgentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const taskId = await ctx.db.insert("tasks", {
      ...args,
      aiStatus: args.isAI ? "assigned" : undefined,
      aiStartedAt: undefined,
      aiProgress: args.isAI ? 0 : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // If it's an AI task and has a scheduled time, schedule it using Convex scheduler
    if (args.isAI && args.scheduledAt && args.scheduledAt > Date.now()) {
      const scheduledJobId = await ctx.scheduler.runAt(args.scheduledAt, internal.tasks.executeScheduledTask, {
        id: taskId,
        title: args.title,
        description: args.description,
        agent: args.agent,
      });
      
      // Store the job ID so we can potentially cancel it later
      await ctx.db.patch(taskId, {
        scheduledTaskId: scheduledJobId,
      });
      
      console.log(`Scheduled AI task ${taskId} for ${new Date(args.scheduledAt).toISOString()} (Job ID: ${scheduledJobId})`);
    } else if (args.isAI && !args.scheduledAt && !args.heartbeatAgentId) {
      // If it's an immediate AI task and NOT a heartbeat task, we could also schedule it for "now"
      // But the frontend currently handles immediate execution via /api/openclaw/execute
      console.log(`Immediate AI task ${taskId} created (will be executed by frontend)`);
    }

    return taskId;
  },
});

// Update task status
export const updateTaskStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Update task
export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    isAI: v.optional(v.boolean()),
    agent: v.optional(v.string()),
    aiStatus: v.optional(v.string()),
    aiProgress: v.optional(v.number()),
    aiResponse: v.optional(v.string()),
    aiResponseShort: v.optional(v.string()),
    aiBlockers: v.optional(v.array(v.string())),
    openclawSessionId: v.optional(v.string()),
    openclawTaskId: v.optional(v.string()),
    parentTaskId: v.optional(v.string()),
    isSubtask: v.optional(v.boolean()),
    createdBy: v.optional(v.string()),
    subtaskMode: v.optional(v.string()),
    heartbeatAgentId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Update AI task progress
export const updateAIProgress = mutation({
  args: {
    id: v.id("tasks"),
    aiStatus: v.string(),
    aiProgress: v.number(),
    aiResponse: v.optional(v.string()),
    aiResponseShort: v.optional(v.string()),
    aiBlockers: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, aiStatus, ...updates } = args;
    const now = Date.now();
    const startFields = aiStatus === "running" ? { aiStartedAt: now } : {};
    // Set completed timestamp when AI finishes
    const completionFields = (aiStatus === "completed" || aiStatus === "failed") 
      ? { aiCompletedAt: now }
      : {};
    await ctx.db.patch(id, {
      aiStatus,
      ...updates,
      ...startFields,
      ...completionFields,
      updatedAt: now,
    });
  },
});

// Link OpenClaw session to task
export const linkOpenClawSession = mutation({
  args: {
    id: v.id("tasks"),
    openclawSessionId: v.string(),
    openclawTaskId: v.optional(v.string()),
    aiStatus: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete task
export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Internal mutation to clear scheduledTaskId
export const clearScheduledTask = internalMutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      scheduledTaskId: undefined,
    });
  },
});

// Action to execute a scheduled task via OpenClaw
export const executeScheduledTask = internalAction({
  args: { 
    id: v.id("tasks"),
    title: v.string(),
    description: v.optional(v.string()),
    agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, title, description, agent } = args;
    
    try {
      console.log(`[SCHEDULED] Starting execution for task ${id}: ${title}`);
      
      const agentId = agent || "main";
      const model = process.env.OPENCLAW_DEFAULT_MODEL || "google/gemini-3-flash-preview";
      const prompt = description ? `Task: ${title}\n\nDescription: ${description}` : `Task: ${title}`;
      const sessionKey = `agent:${agentId}:task:${id}`;

      // 1. Update status to running
      await ctx.runMutation(api.tasks.updateAIProgress, {
        id,
        aiStatus: "running",
        aiProgress: 10,
        aiResponseShort: "Task started via scheduler...",
      });

      await ctx.runMutation(api.tasks.updateTask, {
        id,
        openclawSessionId: sessionKey,
      });

      // 2. Dispatch to OpenClaw
      const openClawUrls = getOpenClawUrls();
      let dispatched = false;
      const errors: string[] = [];

      if (openClawUrls.length === 0) {
        throw new Error("No OpenClaw URL configured. Please set OPENCLAW_URL in your Convex Dashboard.");
      }

      for (const url of openClawUrls) {
        const { baseUrl, header } = getOpenClawAuth(url);
        
        // Check for localhost/127.0.0.1 which won't work from Convex cloud
        if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
          const errorMsg = `Invalid OpenClaw URL: ${baseUrl}. Convex cannot connect to your local machine (localhost). Please use a public URL or a tunnel (like ngrok or Cloudflare) and set it in your Convex Dashboard as OPENCLAW_URL.`;
          console.error(`[SCHEDULED] ${errorMsg}`);
          errors.push(errorMsg);
          continue;
        }

        console.log(`[SCHEDULED] Trying OpenClaw at ${baseUrl}`);

        try {
          const response = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(header && { "Authorization": header }),
              "x-openclaw-agent-id": agentId,
              "x-openclaw-session-key": sessionKey,
              "x-openclaw-task-id": id,
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: prompt }],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const content = data?.choices?.[0]?.message?.content || "";
            
            if (content) {
              console.log(`[SCHEDULED] Task ${id} completed successfully`);
              
              // 3. Update Convex with results
              await ctx.runMutation(api.tasks.updateAIProgress, {
                id,
                aiStatus: "completed",
                aiProgress: 100,
                aiResponse: content,
                aiResponseShort: content.slice(0, 200),
              });

              await ctx.runMutation(api.tasks.updateTaskStatus, {
                id,
                status: "review",
              });

              // Create agent run record
              const runId = await ctx.runMutation(api.agentRuns.createAgentRun, {
                taskId: id,
                agent: agentId,
                prompt,
              } as any);

              if (runId) {
                await ctx.runMutation(api.agentRuns.completeAgentRun, {
                  id: runId as any,
                  status: "completed",
                  response: content,
                  progress: 100,
                });
              }

              dispatched = true;
              break;
            }
          } else {
            const errText = await response.text().catch(() => response.statusText);
            errors.push(`${baseUrl}: ${response.status} ${errText}`);
          }
        } catch (err: any) {
          errors.push(`${baseUrl}: ${err.message || String(err)}`);
        }
      }

      if (!dispatched) {
        const lastReason = errors.length > 0 ? errors[errors.length - 1] : "OpenClaw unreachable";
        throw new Error(lastReason);
      }

    } catch (err: any) {
      console.error(`[SCHEDULED] Error executing task ${id}:`, err);
      
      // Mark as failed in Convex
      await ctx.runMutation(api.tasks.updateAIProgress, {
        id,
        aiStatus: "failed",
        aiProgress: 0,
        aiResponseShort: err.message || "Execution failed",
      }).catch(() => {});

    } finally {
      // Clear the scheduledTaskId
      await ctx.runMutation(internal.tasks.clearScheduledTask, { id });
    }
  },
});
