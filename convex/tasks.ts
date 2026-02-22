import { query, mutation, internalMutation, action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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

// Action to execute a scheduled task via the app's own execution endpoint
export const executeScheduledTask = internalAction({
  args: { 
    id: v.id("tasks"),
    title: v.string(),
    description: v.optional(v.string()),
    agent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    
    try {
      console.log(`[SCHEDULED] Executing task ${args.id}: ${args.title}`);
      
      const response = await fetch(`${appUrl}/api/openclaw/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: args.title,
          description: args.description,
          agent: args.agent,
          taskId: args.id,
        }),
      });

      if (!response.ok) {
        console.error(`[SCHEDULED] Failed to execute task ${args.id}: ${response.statusText}`);
      } else {
        console.log(`[SCHEDULED] Task ${args.id} executed successfully`);
      }
    } catch (err) {
      console.error(`[SCHEDULED] Error executing task ${args.id}:`, err);
    } finally {
      // Clear the scheduledTaskId regardless of success
      await ctx.runMutation(internal.tasks.clearScheduledTask, { id: args.id });
    }
  },
});
