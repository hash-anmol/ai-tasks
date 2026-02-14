import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all agent runs
export const getAgentRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agentRuns").collect();
  },
});

// Get agent runs by task
export const getAgentRunsByTask = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentRuns")
      .filter((q) => q.eq(q.field("taskId"), args.taskId))
      .collect();
  },
});

// Get active agent runs
export const getActiveRuns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("agentRuns")
      .filter((q) => q.eq(q.field("status"), "running"))
      .collect();
  },
});

// Create agent run
export const createAgentRun = mutation({
  args: {
    taskId: v.optional(v.string()),
    agent: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const runId = await ctx.db.insert("agentRuns", {
      ...args,
      status: "pending",
      response: "",
      progress: 0,
      startedAt: Date.now(),
    });
    return runId;
  },
});

// Update agent run
export const updateAgentRun = mutation({
  args: {
    id: v.id("agentRuns"),
    status: v.optional(v.string()),
    response: v.optional(v.string()),
    progress: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

// Complete agent run with response
export const completeAgentRun = mutation({
  args: {
    id: v.id("agentRuns"),
    status: v.string(),
    response: v.string(),
    progress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      response: args.response,
      progress: args.progress,
      completedAt: Date.now(),
    });
  },
});
