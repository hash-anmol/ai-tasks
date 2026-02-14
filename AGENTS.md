# AI Tasks - Agent System

This document describes the AI agent system in the AI Tasks app.

## Agent Types

| Agent | Emoji | Role | Capabilities |
|-------|-------|------|--------------|
| Coordinator | 🎯 | Breaks down complex tasks | Task planning, delegation |
| Researcher | 🔍 | Finds information | Web search, research |
| Writer | ✍️ | Creates content | Writing, drafting |
| Editor | 📝 | Reviews and edits | Proofreading, refinement |

## How It Works

### 1. Creating an AI Task

When you create a task and mark it as "AI Task":
1. Task is saved to Convex database
2. If scheduled for "now", task is sent to OpenClaw
3. OpenClaw spawns the appropriate agent
4. Agent executes the task
5. Results are stored and displayed in the app

### 2. Agent Selection

- **Manual:** Select an agent when creating the task
- **Auto:** Leave blank and the Coordinator agent will assign it

### 3. Viewing Results

- **Task Detail:** Full AI conversation visible
- **Agents Tab:** Shows all agent activity and history

## OpenClaw Integration

```
AI Tasks App → OpenClaw Gateway → AI Agent → Results → AI Tasks
```

### Configuration

Set these environment variables:

```env
# In AI Tasks (.env.local)
NEXT_PUBLIC_OPENCLAW_URL=http://homeserver:18789
OPENCLAW_TOKEN=your-gateway-token

# In OpenClaw
OPENCLAW_WEBHOOK_URL=https://your-vercel-url/api/webhooks/openclaw
```

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/openclaw/execute` | Send task to OpenClaw |
| `/api/openclaw/status/:id` | Check task status |
| `/api/webhooks/openclaw` | Receive results from OpenClaw |

## Data Flow

```
User creates AI task
    ↓
POST /api/openclaw/execute
    ↓
OpenClaw spawns agent
    ↓
Agent executes task
    ↓
OpenClaw calls webhook (or AI Tasks polls)
    ↓
Results stored in Convex
    ↓
UI updates with progress and results
```

## Troubleshooting

### OpenClaw not reachable
- Check Tailscale connection
- Verify `NEXT_PUBLIC_OPENCLAW_URL` is correct
- Ensure gateway is running

### Tasks not showing progress
- Check Convex is connected: `npx convex dev`
- Verify webhook URL is configured in OpenClaw
- Check browser console for errors

### Agent not responding
- Check agent is configured in OpenClaw
- Verify agent has required skills
- Check OpenClaw logs
