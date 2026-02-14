# AI Tasks + OpenClaw Integration Plan

**Created:** 2026-02-14
**Status:** Planning Phase

---

## 1. Problem Statement

Current AI Tasks app issues:
- ❌ AI Agent responses not visible in Agents tab
- ❌ Kanban board not working
- ❌ Convex DB not set up
- ❌ No connection to OpenClaw AI Agent

**Goal:** Connect AI Tasks app to OpenClaw so AI tasks are executed by your actual AI agent, with full conversation visibility.

---

## 2. User Flow

```
User creates AI task
       │
       ▼
┌──────────────────┐
│ Select Agent     │ ← Researcher/Writer/Editor/Coordinator
│ (optional)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Set Schedule     │ ← Empty = Now
│ (optional)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Task Created     │
│ Status: pending  │
└────────┬─────────┘
         │
         ▼         (If schedule = now)
┌──────────────────────────────────────┐
│ Send to OpenClaw Agent               │
│ - Prompt = task title + description  │
│ - Store openclawSessionId            │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ OpenClaw Agent executes task         │
│ - Spawns agent or uses main agent    │
│ - Runs task                          │
│ - Returns result                     │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Store result in AI Tasks             │
│ - aiResponse: full conversation      │
│ - aiProgress: 0-100%                 │
│ - aiStatus: completed                │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ User sees in UI:                     │
│ - Task detail: full AI chat          │
│ - Agents tab: agent's work            │
└──────────────────────────────────────┘
```

---

## 3. Integration Architecture

### Option B: AI Tasks Controls OpenClaw (Selected)

AI Tasks is the controller → calls OpenClaw to execute tasks

```
┌─────────────────┐      HTTP       ┌─────────────────┐
│  AI Tasks App   │ ◀──────────────▶ │  OpenClaw       │
│  (Next.js)      │   /api/sessions  │  Gateway        │
│                 │                  │                 │
│ - UI/UX         │                  │ - AI Agent      │
│ - Task CRUD     │                  │ - Skills        │
│ - Kanban        │                  │ - Memory        │
└────────┬────────┘                  └────────┬────────┘
         │                                    │
         │ GET /status                        │
         │◀───────────────────────────────────┤
         │                                    │
         │ POST /sessions (spawn agent)       │
         ├───────────────────────────────────▶│
         │                                    │
         │ Agent executes task                │
         │                                    │
         │◀───────────────────────────────────┤
         │ Returns result                     │
         │                                    │
         ▼                                    ▼
```

### Connection URL

| Environment | URL |
|-------------|-----|
| Local (Tailscale) | `http://homeserver:18789` |
| Production | `https://openclaw.your-domain.com` |

---

## 4. Data Model

### Task Schema (additions)

```typescript
interface Task {
  _id: string;
  title: string;
  description?: string;
  
  // AI Integration
  isAI: boolean;
  agent?: "researcher" | "writer" | "editor" | "coordinator";
  openclawSessionId?: string;
  openclawTaskId?: string;
  
  // AI Results
  aiStatus?: "pending" | "running" | "completed" | "failed";
  aiProgress?: number;
  aiResponse?: string;        // Full conversation
  aiResponseShort?: string;   // Preview for cards
  
  // Timing
  scheduledAt?: number;        // Unix timestamp
  createdAt: number;
}
```

### Agent Run Schema (new)

```typescript
interface AgentRun {
  _id: string;
  taskId: string;
  agent: string;
  status: "pending" | "running" | "completed" | "failed";
  prompt: string;
  response: string;           // Full conversation
  progress: number;           // 0-100
  startedAt: number;
  completedAt?: number;
}
```

---

## 5. API Endpoints

### AI Tasks → OpenClaw

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/openclaw/execute` | POST | Spawn agent to run task |
| `/api/openclaw/status/:sessionId` | GET | Check task progress |
| `/api/openclaw/webhook` | POST | Receive results from OpenClaw |

### OpenClaw → AI Tasks (Webhook)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/openclaw` | POST | OpenClaw sends task updates |

---

## 6. Implementation Phases

### Phase 1: Fix Current Bugs
- [ ] Fix Kanban board drag-and-drop
- [ ] Show AI response in Agents tab
- [ ] Store full AI conversation in task detail

### Phase 2: OpenClaw Connection
- [ ] Add OpenClaw client/config
- [ ] Create `/api/openclaw/execute` endpoint
- [ ] Test connection to OpenClaw gateway

### Phase 3: Task Execution Flow
- [ ] When AI task created → call OpenClaw
- [ ] Store session ID in task
- [ ] Poll for results OR webhook

### Phase 4: Display Results
- [ ] Show full conversation in task detail
- [ ] Show agent's work in Agents tab
- [ ] Real-time progress updates

---

## 7. Files to Modify

| File | Change |
|------|--------|
| `src/components/KanbanBoard.tsx` | Fix drag-and-drop |
| `src/components/TaskList.tsx` | Show AI responses |
| `src/app/agents/page.tsx` | Show agent conversations |
| `src/app/api/openclaw/execute/route.ts` | New - execute task |
| `src/app/api/openclaw/status/route.ts` | New - check progress |
| `src/app/api/webhooks/openclaw/route.ts` | New - receive results |
| `src/lib/openclaw.ts` | New - OpenClaw client |
| `src/app/page.tsx` | Add webhook endpoint config |

---

## 8. Testing Plan

### Phase 1 Tests
- [ ] Create task → appears in Kanban
- [ ] Drag task between columns → status updates
- [ ] Create AI task → shows progress bar
- [ ] Complete AI task → shows response

### Phase 2 Tests
- [ ] OpenClaw reachable from AI Tasks
- [ ] Can spawn new session
- [ ] Can send message to agent
- [ ] Can receive response

### Phase 3-4 Tests
- [ ] Full flow: Create AI task → Agent runs → Result shown
- [ ] Multiple concurrent AI tasks
- [ ] Agent conversation visible in task detail
- [ ] Agent visible in Agents tab with work history

---

## 9. Configuration

### Environment Variables

```env
# AI Tasks (.env.local)
OPENCLAW_URL=http://homeserver:18789
OPENCLAW_TOKEN=your-gateway-token

# OpenClaw (optional - if webhook)
OPENCLAW_WEBHOOK_URL=https://ai-tasks.vercel.app/api/webhooks/openclaw
```

### OpenClaw Session Config

```json
{
  "sessionTarget": "isolated",
  "model": "minimax/MiniMax-M2.5",
  "timeout": 300
}
```

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tailscale not accessible | Can't reach OpenClaw | Use ngrok or Vercel for webhook |
| Agent takes too long | Timeout | Increase timeout, show progress |
| Concurrent requests | Rate limits | Queue system |
| Lost connection | Task stuck | Webhook + polling fallback |

---

## 11. Timeline Estimate

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Bugs | 2 hours | None |
| Phase 2: Connection | 3 hours | OpenClaw reachable |
| Phase 3: Execution | 4 hours | Phase 2 |
| Phase 4: Display | 2 hours | Phase 3 |

**Total:** ~11 hours

---

## 12. Next Steps

1. ✅ **This plan** - confirmed
2. ✅ Phase 1 partially done: Fixed Kanban board view toggle
3. Phase 2: Set up Convex (Anmol running locally)
4. Continue through remaining phases

---

## 13. Completed So Far

- ✅ Fixed Kanban board toggle (now shows when clicking kanban icon)
- ✅ Created Convex schema (`convex/schema.ts`)
- ✅ Created Convex functions (`convex/tasks.ts`, `convex/agentRuns.ts`)
- ✅ Created OpenClaw client (`src/lib/openclaw.ts`)
- ✅ Created execute API (`/api/openclaw/execute`)
- ✅ Created webhook endpoint (`/api/webhooks/openclaw`)
- ✅ Created AGENTS.md documentation

**Pending:**
- Run `npx convex dev` to deploy schema
- Configure environment variables
- Test full flow
