import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal("pending"), v.literal("in_progress"), v.literal("done"))),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    
    // AI-specific fields
    isAI: v.boolean(),
    aiProgress: v.optional(v.number()),
    aiNotes: v.optional(v.string()),
    aiStatus: v.optional(v.union(v.literal("assigned"), v.literal("working"), v.literal("completed"))),
    openclawTaskId: v.optional(v.string()),
    
    // Metadata
    dueDate: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),
});
