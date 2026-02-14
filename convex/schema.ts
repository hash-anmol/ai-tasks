import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.string(), // "inbox" | "assigned" | "in_progress" | "review" | "done"
    priority: v.optional(v.string()), // "low" | "medium" | "high"
    dueDate: v.optional(v.number()),
    tags: v.array(v.string()),
    isAI: v.boolean(),
    agent: v.optional(v.string()), // "researcher" | "writer" | "editor" | "coordinator"
    openclawSessionId: v.optional(v.string()),
    openclawTaskId: v.optional(v.string()),
    aiStatus: v.optional(v.string()), // "pending" | "running" | "completed" | "failed"
    aiProgress: v.optional(v.number()),
    aiResponse: v.optional(v.string()),
    aiResponseShort: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
    dependsOn: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  agentRuns: defineTable({
    taskId: v.optional(v.string()),
    agent: v.string(),
    status: v.string(), // "pending" | "running" | "completed" | "failed"
    prompt: v.string(),
    response: v.optional(v.string()),
    progress: v.number(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }),

  activities: defineTable({
    type: v.string(), // "task_created" | "task_completed" | "ai_started" | "ai_completed"
    message: v.string(),
    taskId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    createdAt: v.number(),
  }),
});
