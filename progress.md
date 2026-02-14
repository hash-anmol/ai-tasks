# AI Tasks - Project Progress

**Project Location:** `/home/anmol/.openclaw/workspace/ai-tasks/`
**Vercel URL:** https://ai-tasks-zeta.vercel.app

---

## Project Overview

- **Name:** AI Tasks - Task Manager with AI Agent Integration
- **Tech Stack:** Next.js 16, Tailwind CSS, Convex DB, OpenClaw Webhooks
- **Current Status:** MVP UI + Gamification done, need OpenClaw integration + Convex DB

---

## 🚨 PRIORITY TASKS (Build in Order)

### Task 1: Set Up Convex Database (HIGH PRIORITY)
- [ ] Run `npx convex dev` to set up Convex project
- [ ] Create schema for tasks with AI fields
- [ ] Add Convex provider to Next.js app
- [ ] Migrate from localStorage to Convex
- [ ] Test CRUD operations
- [ ] Deploy with `npx convex deploy`

### Task 2: OpenClaw Webhook Integration (HIGH PRIORITY)
- [ ] Create webhook endpoint `/api/webhook/openclaw`
- [ ] Receive task updates from OpenClaw
- [ ] Store OpenClaw task IDs and status
- [ ] Display webhook status in UI

### Task 3: AI Task Features
- [ ] Add "AI Task" creation button
- [ ] Display AI progress bar (pending/working/completed)
- [ ] Add AI notes section to each task
- [ ] Show AI status indicator (assigned/in_progress/done)
- [ ] Display AI thinking/progress updates

### Task 4: GitHub Push
- [ ] Create GitHub repo (already authenticated!)
- [ ] Push all commits to main branch
- [ ] Add .gitignore for node_modules, .next, etc.

### Task 5: Polish & Testing
- [ ] Test all features on Vercel
- [ ] Fix any bugs
- [ ] Add more gamification (achievements page)

---

## Current Task Status

### ✅ Completed
1. Next.js project with Tailwind CSS
2. TaskList and AddTaskButton components
3. Bottom navigation
4. API endpoint `/api/tasks`
5. Gamification (coins, streaks, XP, levels)
6. Vercel deployment
7. GitHub authentication (READY!)

### ⏳ In Progress
1. Convex database setup
2. OpenClaw webhook integration

### ❌ Not Started
1. AI task progress display
2. AI notes field
3. GitHub push

---

## Detailed Technical Requirements

### Convex Schema (Task 1)
```typescript
// convex/schema.ts
export default defineSchema({
  tasks: defineTable({
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("in_progress"), v.literal("done")),
    priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"))),
    
    // AI-specific fields
    isAI: v.boolean(),
    aiProgress: v.optional(v.number()), // 0-100
    aiNotes: v.optional(v.string()),
    aiStatus: v.optional(v.union(v.literal("assigned"), v.literal("working"), v.literal("completed"))),
    openclawTaskId: v.optional(v.string()),
    
    // Gamification
    coinsEarned: v.optional(v.number()),
    
    // Metadata
    dueDate: v.optional(v.string()),
    tags: v.array(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }),
});
```

### OpenClaw Webhook (Task 2)
```typescript
// POST /api/webhook/openclaw
// Receives: { taskId, status, progress, notes }
// Updates task in Convex
```

### AI Task UI Updates (Task 3)
- Progress bar showing AI work status (0%, 25%, 50%, 75%, 100%)
- "AI Notes" expandable section
- Status badges: "Assigned to AI", "AI Working", "AI Completed"
- Real-time updates via Convex subscriptions

---

## Scheduled Jobs
- **Every 15 min:** Continue development (heartbeat)
- **7:30 AM daily:** Morning progress summary to Telegram

---

## GitHub Status
- ✅ AUTHENTICATED! Can push now
- Need to create repo and push

---

## Resources
- Convex Docs: https://docs.convex.dev/home
- Convex Next.js Quickstart: https://docs.convex.dev/quickstart/nextjs

---

## Notes
- Using Tailwind v4 with @theme for colors
- Green accent: #13ec5b
- Material Icons for UI
- localStorage currently for gamification stats
