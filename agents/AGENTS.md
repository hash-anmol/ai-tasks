# AGENTS.md -- AI Tasks Multi-Agent System

## Overview

AI Tasks uses a 4-agent system. Each agent has its own workspace with a SOUL.md that defines its personality and capabilities.

| Agent | ID | Workspace | Role |
|-------|------|-----------|------|
| Scout (Researcher) | `researcher` | `/home/anmol/.openclaw/workspace-researcher/` | Research and gather information |
| Writer | `writer` | `/home/anmol/.openclaw/workspace-writer/` | Create content from research |
| Editor | `editor` | `/home/anmol/.openclaw/workspace-editor/` | Review and approve content |
| Nexus (Coordinator) | `coordinator` | `/home/anmol/.openclaw/workspace-coordinator/` | Orchestrate, decompose, delegate |

## Agent Workspaces

Each agent workspace contains:
- `SOUL.md` -- The agent's identity, personality, and operating instructions
- `AGENTS.md` -- Standard OpenClaw workspace rules
- `USER.md` -- Info about the user
- `TOOLS.md` -- Tool-specific notes
- `memory/` -- Per-agent memory files

## How It Works

### Direct Assignment
User picks an agent when creating a task. That agent executes the work directly.

### Coordinator Delegation
For complex tasks, the Coordinator (Nexus) analyzes the task, breaks it into subtasks, and delegates to specialist agents. Nexus:
- Creates subtasks in the UI via the webhook/API
- Sets `dependsOn` for sequential work
- Leaves independent subtasks to run in parallel
- Monitors progress and adjusts the plan if needed

### Task Flow Options
```
Simple:   [Task] → [Agent] → [Done]
Complex:  [Task] → [Coordinator] → [Subtask 1: Research] → [Subtask 2: Write] → [Subtask 3: Review] → [Done]
Parallel: [Task] → [Coordinator] → [Subtask A: Research Topic 1] ─┐
                                  → [Subtask B: Research Topic 2] ─┤→ [Subtask C: Write Summary] → [Done]
```

## Status Updates
- **Assigned** -- Agent picked up task
- **Running** -- Agent actively working
- **Completed** -- Task done
- **Failed** -- Task errored or was stopped
- **Blocked** -- Waiting on dependencies or input

## Technical Details

### Execution
- Tasks are sent to OpenClaw via `/api/openclaw/execute` with `x-openclaw-agent-id` header
- OpenClaw routes to the correct agent based on the agent ID
- Progress updates come back via webhook at `/api/webhooks/openclaw`
- Webhook updates Convex DB (source of truth for UI)

### Session Continuity
- Each task execution can be linked to a session via `sessionId`
- Sessions are stored in Convex `sessions` table
- Users can continue existing sessions when creating new tasks
