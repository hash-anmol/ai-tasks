"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: number;
  tags: string[];
  isAI: boolean;
  agent?: string;
  dependsOn?: string[];
  aiProgress?: number;
  aiNotes?: string;
  aiStatus?: string;
  aiResponse?: string;
  aiResponseShort?: string;
  aiBlockers?: string[];
  openclawTaskId?: string;
  createdAt: number;
  updatedAt: number;
}

const AGENTS = [
  { id: "researcher", name: "Researcher", emoji: "🔍" },
  { id: "writer", name: "Writer", emoji: "✍️" },
  { id: "editor", name: "Editor", emoji: "📝" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯" },
];

const getAgentInfo = (agentId?: string) => AGENTS.find(a => a.id === agentId);

interface ColumnConfig {
  id: string;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnConfig[] = [
  { id: "inbox", label: "Inbox", defaultVisible: true },
  { id: "assigned", label: "Assigned", defaultVisible: true },
  { id: "active", label: "Active", defaultVisible: false },
  { id: "in_progress", label: "In Progress", defaultVisible: false },
  { id: "review", label: "Review", defaultVisible: false },
  { id: "blocked", label: "Blocked", defaultVisible: true },
  { id: "waiting", label: "Waiting", defaultVisible: false },
  { id: "done", label: "Done", defaultVisible: true },
];

// Check if all dependencies are completed
const areDependenciesMet = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependsOn || task.dependsOn.length === 0) return true;
  return task.dependsOn.every(depId => {
    const depTask = allTasks.find(t => t._id === depId);
    return depTask?.status === "done";
  });
};

// Determine the effective column for a task (considering AI status overrides)
const getEffectiveColumn = (task: Task): string => {
  if (task.isAI && task.aiStatus) {
    switch (task.aiStatus) {
      case "running":
        return "active";
      case "blocked":
        return "blocked";
      case "completed":
        return "done";
      case "failed":
        return "blocked";
      case "pending":
        return task.status;
    }
  }
  return task.status;
};

export default function KanbanBoard() {
  const tasksQuery = useQuery(api.tasks.getTasks);
  const isLoading = tasksQuery === undefined;
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    () => new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id))
  );
  const [showAll, setShowAll] = useState(false);
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);

  const taskList = (tasksQuery || []) as Task[];

  // Keep a ref to taskList so touch handlers always have the latest
  const taskListRef = useRef<Task[]>(taskList);
  taskListRef.current = taskList;
  // Touch drag-and-drop state
  const touchDragRef = useRef<{
    taskId: string;
    clone: HTMLElement | null;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const columnRefs = useRef<Map<string, HTMLElement>>(new Map());

  const setColumnRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) columnRefs.current.set(id, el);
    else columnRefs.current.delete(id);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, taskId: string, isVirtual: boolean, canDrag: boolean) => {
    if (isVirtual || !canDrag) return;
    
    const touch = e.touches[0];
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    // Create visual clone
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.position = "fixed";
    clone.style.width = `${rect.width}px`;
    clone.style.zIndex = "9999";
    clone.style.opacity = "0.9";
    clone.style.transform = "scale(1.05) rotate(2deg)";
    clone.style.pointerEvents = "none";
    clone.style.boxShadow = "0 8px 25px rgba(0,0,0,0.2)";
    clone.style.borderRadius = "12px";
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.transition = "transform 0.15s ease, opacity 0.15s ease";
    document.body.appendChild(clone);

    touchDragRef.current = {
      taskId,
      clone,
      startX: touch.clientX,
      startY: touch.clientY,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };

    setDraggedTask(taskId);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragRef.current?.clone) return;
    e.preventDefault();

    const touch = e.touches[0];
    const { clone, offsetX, offsetY } = touchDragRef.current;
    clone.style.left = `${touch.clientX - offsetX}px`;
    clone.style.top = `${touch.clientY - offsetY}px`;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const dragData = touchDragRef.current;
    if (!dragData) return;

    // Remove clone
    if (dragData.clone) {
      dragData.clone.remove();
    }

    // Find which column the touch ended over
    const touch = e.changedTouches[0];
    const dropX = touch.clientX;
    const dropY = touch.clientY;

    let targetColumnId: string | null = null;
    columnRefs.current.forEach((el, id) => {
      const rect = el.getBoundingClientRect();
      if (dropX >= rect.left && dropX <= rect.right && dropY >= rect.top && dropY <= rect.bottom) {
        targetColumnId = id;
      }
    });

    if (targetColumnId) {
      // Inline drop logic using ref data to avoid stale closures
      const currentTaskList = taskListRef.current;
      const task = currentTaskList.find(t => t._id === dragData.taskId);
      if (task) {
        const validStatuses: TaskStatus[] = ["inbox", "assigned", "in_progress", "review", "done"];
        const targetStatus = targetColumnId as TaskStatus;

        if (validStatuses.includes(targetStatus)) {
          if (targetStatus !== "done" || areDependenciesMet(task, currentTaskList)) {
            try {
              updateTaskStatus({ id: task._id as any, status: targetStatus } as any);
            } catch (error) {
              console.error("Error updating status:", error);
            }
          }
        }
      }
    }

    setDraggedTask(null);
    touchDragRef.current = null;
  }, [updateTaskStatus]);

  const activeColumns = showAll
    ? ALL_COLUMNS
    : ALL_COLUMNS.filter(c => visibleColumns.has(c.id));

  const toggleColumn = (colId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
    if (showAll) setShowAll(false);
  };

  const handleToggleAll = () => {
    setShowAll(!showAll);
  };

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (columnId: string) => {
    if (!draggedTask) return;

    const task = taskList.find(t => t._id === draggedTask);
    if (!task) return;

    // Only allow dropping into actual task statuses, not virtual columns
    const validStatuses: TaskStatus[] = ["inbox", "assigned", "in_progress", "review", "done"];
    const targetStatus = columnId as TaskStatus;

    if (!validStatuses.includes(targetStatus)) {
      // For virtual columns (active, blocked, waiting), ignore the drop
      setDraggedTask(null);
      return;
    }

    // Prevent moving to done if dependencies aren't met
    if (targetStatus === "done" && !areDependenciesMet(task, taskList)) {
      setDraggedTask(null);
      return;
    }

    try {
      updateTaskStatus({ id: task._id as any, status: targetStatus } as any);
    } catch (error) {
      console.error("Error updating status:", error);
    }
    setDraggedTask(null);
  };

  const getTasksByColumn = (columnId: string) => {
    return taskList.filter(t => getEffectiveColumn(t) === columnId);
  };

  const getPriorityDot = (priority?: string) => {
    switch (priority) {
      case "high": return "bg-red-400";
      case "medium": return "bg-amber-400";
      case "low": return "bg-gray-300";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[var(--text-secondary)] text-sm font-light opacity-50">Loading board...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Column toggles */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto hide-scrollbar pb-1">
        <button
          onClick={handleToggleAll}
          className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all border ${
            showAll
              ? "bg-[var(--text-primary)] text-[var(--background)] border-[var(--text-primary)]"
              : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]"
          }`}
        >
          All
        </button>
        <div className="w-px h-4 bg-[var(--border)] flex-shrink-0" />
        {ALL_COLUMNS.map(col => {
          const count = getTasksByColumn(col.id).length;
          const isVisible = showAll || visibleColumns.has(col.id);
          return (
            <button
              key={col.id}
              onClick={() => toggleColumn(col.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2 border ${
                isVisible
                  ? "bg-[var(--text-primary)] text-[var(--background)] border-[var(--text-primary)]"
                  : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]"
              }`}
            >
              {col.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 min-w-[18px] text-center rounded-full ${
                  isVisible ? "bg-[var(--background)]/20" : "bg-[var(--background)] opacity-60"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 hide-scrollbar">
        {activeColumns.map(column => {
          const tasks = getTasksByColumn(column.id);
          const isVirtual = !["inbox", "assigned", "in_progress", "review", "done"].includes(column.id);

          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-[290px]"
              ref={(el) => setColumnRef(column.id, el)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-[15px] font-semibold text-[var(--text-primary)]">
                    {column.label}
                  </h3>
                  <span className="text-xs text-[var(--text-secondary)] opacity-50 font-light">{tasks.length}</span>
                </div>
                {isVirtual && (
                  <span className="text-[9px] font-bold uppercase tracking-tighter text-[var(--text-secondary)] bg-[var(--surface)] border border-[var(--border)] px-1.5 py-0.5 rounded opacity-60">AI Column</span>
                )}
              </div>

              {/* Column body */}
              <div className="space-y-3 min-h-[300px] bg-[var(--surface)]/30 border border-[var(--border)]/30 rounded-2xl p-3 transition-colors">
                {tasks.map(task => {
                  const canDrag = !isVirtual && areDependenciesMet(task, taskList);
                  return (
                  <div
                    key={task._id}
                    draggable={canDrag}
                    onDragStart={() => handleDragStart(task._id)}
                    onTouchStart={(e) => handleTouchStart(e, task._id, isVirtual, canDrag)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`bg-[var(--surface)] rounded-xl p-4 shadow-sm border transition-all ${
                      canDrag ? "cursor-grab active:cursor-grabbing hover:border-blue-500/30 touch-none" : "cursor-default"
                    } ${
                      draggedTask === task._id ? "opacity-30 scale-95" : "hover:shadow-md"
                    } ${
                      !areDependenciesMet(task, taskList)
                        ? "opacity-50 border-red-500/20 grayscale-[0.5]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    {/* Title row */}
                    <div className="flex items-start justify-between gap-3">
                      <h4 className={`text-[13.5px] leading-relaxed font-light ${
                        !areDependenciesMet(task, taskList) ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"
                      }`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                        {!areDependenciesMet(task, taskList) && (
                          <span className="material-symbols-outlined text-red-400 text-[14px]">lock</span>
                        )}
                        {task.agent && (
                          <span className="text-sm opacity-80" title={getAgentInfo(task.agent)?.name}>
                            {getAgentInfo(task.agent)?.emoji}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AI status indicator */}
                    {task.isAI && task.aiStatus === "running" && (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex gap-0.5">
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-[11px] text-blue-500/80 font-medium">AI Processing</span>
                      </div>
                    )}

                    {task.isAI && task.aiStatus === "completed" && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>
                        <span className="text-[11px] text-green-500/80 font-medium">AI Complete</span>
                      </div>
                    )}

                    {task.isAI && task.aiStatus === "failed" && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-red-400">error</span>
                        <span className="text-[11px] text-red-400 font-medium">Failed</span>
                      </div>
                    )}

                    {task.isAI && task.aiStatus === "blocked" && task.aiBlockers && task.aiBlockers.length > 0 && (
                      <div className="mt-2.5 p-2 bg-red-400/5 rounded-lg border border-red-400/10">
                        <span className="text-[10px] text-red-400 font-medium line-clamp-2">
                          Blocked: {task.aiBlockers[0]}
                        </span>
                      </div>
                    )}

                    {/* AI short response */}
                    {task.isAI && task.aiResponseShort && task.aiStatus === "completed" && (
                      <p className="mt-2.5 text-[11px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed opacity-70 font-light italic">
                        "{task.aiResponseShort}"
                      </p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border)]/30">
                      {task.priority && (
                        <div className={`w-1.5 h-1.5 rounded-full ${getPriorityDot(task.priority)} shadow-sm`}
                          title={task.priority} />
                      )}
                      {task.isAI && (
                        <span className="text-[9px] font-bold tracking-wider text-[var(--text-secondary)] opacity-50 uppercase">
                          AI Task
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="text-[10px] text-[var(--text-secondary)] opacity-40 font-light ml-auto">
                          {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  );
                })}

                {tasks.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 opacity-20">
                    <span className="material-symbols-outlined text-2xl mb-1">view_column</span>
                    <p className="text-[var(--text-secondary)] text-[10px] uppercase tracking-widest font-bold">Empty</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
