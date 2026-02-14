# AGENTS.md — AI Tasks Multi-Agent System

## Overview
AI Tasks uses a 4-agent system for task completion:
- 🔍 **Researcher** — Research and gather information
- ✍️ **Writer** — Create content from research
- 📝 **Editor** — Review and approve content
- 🎯 **Coordinator** — Orchestrate and track progress

## Agent Communication
1. Coordinator breaks task into subtasks
2. Researcher completes research → passes to Writer
3. Writer creates draft → passes to Editor
4. Editor reviews → approves or requests changes
5. Coordinator tracks status and reports

## Task Flow
```
[New Task] → Coordinator decomposes → [Research] → [Write] → [Review] → [Done]
```

## How to Assign
- When creating a task, select "AI Task" checkbox
- Choose agent from dropdown (or let Coordinator auto-assign)
- Agent receives task and begins work
- Progress shows in task card (assigned → working → completed)

## Status Updates
- **Assigned** 🤖 - Agent picked up task
- **Working** ⚡ - Agent actively working
- **Completed** ✅ - Task done, awaiting review

## Notes
- Agents leave progress notes in task comments
- Webhook updates task status in real-time
- Each agent follows their SOUL.md personality
