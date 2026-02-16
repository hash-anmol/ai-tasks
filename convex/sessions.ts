import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all sessions
export const getSessions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sessions").collect();
  },
});

// Get sessions by agent
export const getSessionsByAgent = query({
  args: { agent: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("agent"), args.agent))
      .collect();
  },
});

// Get session by OpenClaw sessionId
export const getSessionBySessionId = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();
  },
});

// Upsert session - create or update based on OpenClaw sessionId
export const upsertSession = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
    agent: v.string(),
    status: v.optional(v.string()),
    lastTaskId: v.optional(v.string()),
    lastTaskTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find existing session by sessionId
    const existing = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first();

    if (existing) {
      // Update existing session
      await ctx.db.patch(existing._id, {
        name: args.name || existing.name,
        status: args.status || existing.status,
        taskCount: existing.taskCount + 1,
        lastTaskId: args.lastTaskId || existing.lastTaskId,
        lastTaskTitle: args.lastTaskTitle || existing.lastTaskTitle,
        updatedAt: Date.now(),
      });
      return existing._id;
    } else {
      // Create new session
      const id = await ctx.db.insert("sessions", {
        sessionId: args.sessionId,
        name: args.name,
        agent: args.agent,
        status: args.status || "active",
        taskCount: 1,
        lastTaskId: args.lastTaskId,
        lastTaskTitle: args.lastTaskTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return id;
    }
  },
});

// Update session status
export const updateSessionStatus = mutation({
  args: {
    id: v.id("sessions"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Delete session
export const deleteSession = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
