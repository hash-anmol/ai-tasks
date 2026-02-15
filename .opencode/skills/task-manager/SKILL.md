---
name: task-manager
description: Create and manage tasks in the AI Tasks app. Use this skill when the user asks you to create a task, add a to-do item, or manage their task list.
---

# Task Manager Skill

You can create tasks in the AI Tasks application by making HTTP requests to the app's API.

## Creating a Task

To create a task, make a POST request to the app's task creation API:

```bash
curl -X POST "https://ai-tasks-zeta.vercel.app/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Task title here",
    "description": "Optional description",
    "status": "inbox",
    "priority": "medium",
    "isAI": false,
    "tags": []
  }'
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | The task title |
| description | string | No | Detailed description |
| status | string | No | One of: "inbox", "assigned", "in_progress", "review", "done". Default: "inbox" |
| priority | string | No | One of: "low", "medium", "high". Default: "medium" |
| isAI | boolean | No | Whether this is an AI-executed task. Default: false |
| agent | string | No | Agent ID: "researcher", "writer", "editor", "coordinator" |
| tags | string[] | No | Array of tag strings |
| dueDate | number | No | Unix timestamp in milliseconds |

### Creating an AI Task

To create a task that an AI agent will work on:

```bash
curl -X POST "https://ai-tasks-zeta.vercel.app/api/tasks" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Research topic X",
    "description": "Find the latest information about X",
    "status": "assigned",
    "priority": "high",
    "isAI": true,
    "agent": "researcher",
    "tags": ["research"]
  }'
```

## When to Create Tasks

Create tasks when the user:
- Says "add a task", "create a task", "remind me to..."
- Asks you to "add that to my to-do list"
- Mentions something they need to do later
- Wants to delegate work to a specific agent

## Response Format

After creating a task, confirm to the user with:
- The task title
- The priority level
- Whether it's an AI task and which agent is assigned
- Any due date set
