# AI Tasks - Heartbeat Checklist

Run every 15 minutes during heartbeat:

## 1. Check for New Tasks
- [ ] Read localStorage for unassigned AI tasks
- [ ] Pick next available task

## 2. Update Task Status
- [ ] If task assigned → mark as "working"
- [ ] Add progress notes
- [ ] Save to localStorage

## 3. Memory Check
- [ ] Read working memory
- [ ] Update current task
- [ ] Check for blockers

## 4. Complete if Done
- [ ] Mark task complete
- [ ] Award XP/coins
- [ ] Clear working memory

## Agent Workflow
```
1. Poll for unassigned AI tasks
2. Pick highest priority task
3. Update status to "working"
4. Process task (research/write/edit)
5. Update progress notes
6. Mark complete when done
```
