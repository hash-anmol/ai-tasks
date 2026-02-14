# AI Tasks - Project Progress

**Project Location:** `/home/anmol/.openclaw/workspace/ai-tasks/`
**Vercel URL:** https://ai-tasks-zeta.vercel.app

---

## Project Overview

- **Name:** AI Tasks - Task Manager with AI Agent Integration
- **Tech Stack:** Next.js 16, Tailwind CSS, Convex DB, OpenClaw Webhooks
- **Current Status:** MVP UI + Gamification done, adding multi-agent orchestration features
- **Heartbeat:** ✅ Configured - runs every 15 min to pick up tasks

---

## 🚨 PRIORITY TASKS (Build in Order)

### Task 1: Set Up Convex Database (HIGH PRIORITY)
- [ ] Run `npx convex dev` to set up Convex project
- [ ] Create schema for tasks with AI fields
- [ ] Add Convex provider to Next.js app
- [ ] Migrate from localStorage to Convex
- [ ] Test CRUD operations
- [ ] Deploy with `npx convex deploy`

**Testing Plan:**
- [ ] Test: Create task via UI → appears in Convex dashboard
- [ ] Test: Update task → reflects in real-time
- [ ] Test: Delete task → removed from DB
- [ ] Test: Refresh page → data persists

---

### Task 2: OpenClaw Webhook Integration (HIGH PRIORITY)
- [x] Create webhook endpoint `/api/webhook/openclaw` ✅
- [x] Receive task updates from OpenClaw ✅
- [ ] Store OpenClaw task IDs and status (needs Convex)
- [ ] Display webhook status in UI

**Testing Plan:**
- [ ] Test: Send POST to webhook → task updates in DB
- [ ] Test: Invalid payload → returns 400 error
- [ ] Test: Webhook down → graceful error handling

---

### Task 3: AI Task Features
- [x] Add "AI Task" creation button
- [x] Display AI progress bar (pending/working/completed)
- [x] Add AI notes section to each task
- [x] Show AI status indicator (assigned/in_progress/done)
- [ ] Display AI thinking/progress updates (via webhook)

**Testing Plan:**
- [ ] Test: Create AI task → shows progress bar
- [ ] Test: Update aiProgress → bar updates
- [ ] Test: Add aiNotes → displays in expandable section

---

### Task 4: GitHub Push
- [x] Create GitHub repo (already authenticated!)
- [x] Push all commits to main branch
- [x] Add .gitignore for node_modules, .next, etc.

---

### Task 5: 5-Column Kanban Board (NEW)
- [x] Update task status enum to: inbox | assigned | in_progress | review | done ✅
- [x] Create KanbanBoard component with 5 columns ✅
- [x] Add drag-and-drop between columns ✅
- [ ] Persist status changes to Convex

**Testing Plan:**
- [ ] Test: Create task → appears in "Inbox" column
- [ ] Test: Drag task to "In Progress" → status updates
- [ ] Test: Refresh page → task stays in new column
- [ ] Test: Mobile view → columns stack vertically

---

### Task 6: Agent SOUL System (NEW)
- [x] Create `agents/` folder in workspace ✅
- [x] Create `SOUL.md` template for research agent ✅
- [x] Create `SOUL.md` for writer agent ✅
- [x] Create `SOUL.md` for editor agent ✅
- [x] Create `SOUL.md` for coordinator agent ✅
- [x] Add AGENTS.md with operating instructions ✅

**SOUL Template:**
```markdown
# SOUL.md — [Agent Name]

## Role
[One-line description]

## Personality
[Specific traits, constraints]

## What You're Good At
- [Skill 1]
- [Skill 2]

## What You Refuse To Do
- [Constraint 1]
- [Constraint 2]

## Examples of Your Work
[Links to past work]

## Anti-Examples
[What not to do]
```

**Testing Plan:**
- [ ] Test: Agent reads SOUL.md on startup
- [ ] Test: Agent follows personality constraints
- [ ] Test: Multiple agents have distinct personalities

---

### Task 7: Memory System (NEW)
- [x] Create `memory/WORKING.md` - current task state ✅
- [x] Create `memory/DAILY_TEMPLATE.md` - daily logs ✅
- [x] Create `memory/MEMORY.md` - long-term memory ✅
- [x] Add memory read/write functions in app ✅
- [ ] Integrate with agent heartbeat

**Testing Plan:**
- [ ] Test: Write to WORKING.md → persists
- [ ] Test: Read today's date file → creates if not exists
- [ ] Test: MEMORY.md stores across sessions

---

### Task 8: Heartbeat Integration (NEW - Already Exists!)
- [x] Cron job configured: every 15 min ✅
- [ ] Add task polling from Convex
- [x] Add HEARTBEAT.md file with checklist ✅
- [ ] Agent picks next available task
- [ ] Updates task status on pickup

**Testing Plan:**
- [ ] Test: Cron fires → agent logs activity
- [ ] Test: New task appears → agent picks it up
- [ ] Test: No tasks → returns HEARTBEAT_OK

---

### Task 9: Task Dependencies (NEW)
- [x] Add `dependsOn` field to task schema ✅
- [x] Show "waiting on X" blocked status ✅
- [x] Auto-block dependent tasks ✅
- [x] Visual indicator for blocked tasks ✅

**Testing Plan:**
- [ ] Test: Task B depends on A → B blocked until A done
- [ ] Test: Complete A → B unblocks automatically
- [ ] Test: Circular dependency → error handling

---

### Task 10: @Mention System (NEW)
- [x] Add mention parsing in comments (@agent-name) ✅
- [ ] Create notifications table in Convex
- [x] Agent heartbeat checks mentions ✅
- [x] Display unread mention badge ✅

**Testing Plan:**
- [ ] Test: Type @writer → triggers notification
- [ ] Test: Agent heartbeat → picks up mention
- [ ] Test: Mark as read → badge clears

---

### Task 11: Shared Context (AGENTS.md) (NEW)
- [x] Create AGENTS.md in workspace ✅
- [x] Document tool access permissions ✅
- [x] Document memory file locations ✅
- [x] Document communication protocols ✅

**Testing Plan:**
- [ ] Test: Agent reads AGENTS.md on startup
- [ ] Test: All agents follow same operating rules

---

### Task 12: Multi-Agent Role Assignment (NEW)
- [x] Create task assignment UI ✅
- [x] Add agent selector dropdown ✅
- [x] Display assigned agent on task card ✅
- [x] Agent filters by assigneeId ✅

**Testing Plan:**
- [ ] Test: Assign task to "Writer" → shows on task
- [ ] Test: Writer agent → sees assigned task
- [ ] Test: Unassigned tasks → show in Inbox

---

### Task 13: Daily Standup Generator (NEW)
- [x] Create standup query (completed/in_progress/blocked) ✅
- [ ] Add cron for daily standup (11:30 PM IST)
- [x] Format as Telegram-ready message ✅
- [ ] Send to Telegram channel

**Testing Plan:**
- [ ] Test: Cron fires → generates summary
- [ ] Test: Summary includes all 3 sections
- [ ] Test: Message format is readable

---

### Task 14: Agent Cards / Discovery (NEW)
- [ ] Create agents table in Convex
- [ ] Add agent status (idle/active/blocked)
- [ ] Display agent cards in UI
- [ ] Show what each agent is working on

**Testing Plan:**
- [ ] Test: Agent status updates in real-time
- [ ] Test: UI shows all registered agents
- [ ] Test: Click agent → shows their tasks

---

### Task 15: Real-time Activity Feed (NEW)
- [ ] Create activity log table
- [ ] Log: task created, updated, commented
- [ ] Display feed on dashboard
- [ ] Real-time updates via Convex

**Testing Plan:**
- [ ] Test: Create task → appears in feed
- [ ] Test: Update task → new feed entry
- [ ] Test: Feed updates without refresh

---

## Completed Tasks

### ✅ Already Completed
1. Next.js project with Tailwind CSS
2. TaskList and AddTaskButton components
3. Bottom navigation (Calendar, Projects, Settings)
4. API endpoint `/api/tasks`
5. Gamification (coins, streaks, XP, levels)
6. Vercel deployment
7. GitHub repo setup
8. Tab Navigation (Today/Inbox/AI/Archive)
9. Achievements page
10. **Heartbeat: Every 15 min ✅**

---

## Architecture: How Agents Discover Tasks

```
┌─────────────────────────────────────────────────────────┐
│                    HEARTBEAT (15 min)                    │
│  Agent wakes → Read WORKING.md → Query Con vex          │
│ "SELECT * FROM tasks WHERE assigneeId = 'agent'        │
│   AND status = 'assigned'"                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    CONVEY DATABASE                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Tasks   │  │ Agents  │  │ Messages│  │Activity │  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  KANBAN BOARD (UI)                      │
│  Inbox → Assigned → In Progress → Review → Done        │
└─────────────────────────────────────────────────────────┘
```

---

## Agent Roles

| Agent | Role | Trigger |
|-------|------|---------|
| Coordinator | Breaks down tasks | @mention |
| Researcher | Finds sources, verifies | Assigned to research |
| Writer | Creates content | Assigned to drafting |
| Editor | Reviews, edits | Task in Review |
| Developer | Builds features | Assigned to coding |

---

## Scheduled Jobs (CRON)

| Job | Schedule | Purpose |
|-----|----------|---------|
| Continue Development | Every 15 min | Pick up next task |
| Morning Standup | 7:58 AM IST | Wake up + focus |
| Daily Summary | 7:30 PM IST | Progress report |
| Weekly Review | Monday 9 AM | Week summary |

---

## GitHub Status
- ✅ Repo: https://github.com/hash-anmol/ai-tasks

---

## Notes

- Using Tailwind v4 with @theme for colors
- Green accent: #13ec5b
- Material Icons for UI
- localStorage currently for gamification stats
- **Development flow: 15 min per task - build + test → next task**

---

## Testing Standards (Per Task)

Every task must have:
1. ✅ Unit tests for new components
2. ✅ Integration test for Convex/DB operations
3. ✅ E2E test for user flows
4. ✅ Manual verification on Vercel staging

---

## Resources

- Convex Docs: https://docs.convex.dev/home
- Convex Next.js Quickstart: https://docs.convex.dev/quickstart/nextjs
- Article Reference: "The Complete Guide to Building Mission Control" by Bhanu Teja P
- OpenClaw Docs: /home/anmol/.openclaw/workspace/docs
