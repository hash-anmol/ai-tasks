import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all tasks
export const getTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});

// Get task by ID
export const getTask = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Create a new task
export const createTask = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    isAI: v.optional(v.boolean()),
    aiProgress: v.optional(v.number()),
    aiNotes: v.optional(v.string()),
    aiStatus: v.optional(v.union(v.literal("assigned"), v.literal("working"), v.literal("completed"))),
    openclawTaskId: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const task = {
      title: args.title,
      description: args.description || "",
      status: args.status || "pending",
      priority: args.priority || "medium",
      isAI: args.isAI || false,
      aiProgress: args.aiProgress || 0,
      aiNotes: args.aiNotes || "",
      aiStatus: args.aiStatus || (args.isAI ? "assigned" : undefined),
      openclawTaskId: args.openclawTaskId || "",
      dueDate: args.dueDate || "",
      tags: args.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    return await ctx.db.insert("tasks", task);
  },
});

// Update task
export const updateTask = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    aiProgress: v.optional(v.number()),
    aiNotes: v.optional(v.string()),
    aiStatus: v.optional(v.union(v.literal("assigned"), v.literal("working"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, { ...updates, updatedAt: new Date().toISOString() });
  },
});

// Update AI progress
export const updateAIProgress = mutation({
  args: {
    id: v.id("tasks"),
    progress: v.number(),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("assigned"), v.literal("working"), v.literal("completed"))),
  },
  handler: async (ctx, args) => {
    const updates: any = {
      aiProgress: args.progress,
      updatedAt: new Date().toISOString(),
    };
    if (args.notes !== undefined) updates.aiNotes = args.notes;
    if (args.status) updates.aiStatus = args.status;
    await ctx.db.patch(args.id, updates);
  },
});

// Delete task
export const deleteTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Toggle task status
export const toggleTaskStatus = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (task) {
      const newStatus = task.status === "done" ? "pending" : "done";
      await ctx.db.patch(args.id, { 
        status: newStatus,
        updatedAt: new Date().toISOString() 
      });
    }
  },
});
