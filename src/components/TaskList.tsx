"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

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
  aiStartedAt?: number;
  aiCompletedAt?: number;
  aiResponse?: string;
  aiResponseShort?: string;
  aiBlockers?: string[];
  openclawSessionId?: string;
  parentTaskId?: string;
  isSubtask?: boolean;
  createdBy?: string;
  subtaskMode?: string;
  heartbeatAgentId?: string;
  createdAt: number;
  updatedAt: number;
}

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

const AGENTS: Record<string, { name: string; emoji: string; color: string }> = {
  main: { name: "Vertex (General Agent)", emoji: "🧠", color: "text-slate-500/80" },
  researcher: { name: "Scout (Research Agent)", emoji: "🔍", color: "text-blue-500/80" },
  writer: { name: "Writer (Writing Agent)", emoji: "✍️", color: "text-purple-500/80" },
  editor: { name: "Editor (Editing Agent)", emoji: "📝", color: "text-orange-500/80" },
  coordinator: { name: "Nexus (Coordinator Agent)", emoji: "🎯", color: "text-teal-500/80" },
};

const getAgentInfo = (agentId?: string) => agentId ? AGENTS[agentId] : undefined;

const areDependenciesMet = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependsOn || task.dependsOn.length === 0) return true;
  return task.dependsOn.every(depId => {
    const depTask = allTasks.find(t => t._id === depId);
    return depTask?.status === "done";
  });
};

const getDependencyBlockers = (task: Task, allTasks: Task[]): Task[] => {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];
  return task.dependsOn
    .map((depId) => allTasks.find((t) => t._id === depId))
    .filter((depTask): depTask is Task => Boolean(depTask))
    .filter((depTask) => depTask.status !== "done");
};

const getRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  
  if (minutes < 5) return "Now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d`;
};

// Empty state component with contextual messaging
function EmptyState({ activeTab, onChatClick }: { activeTab: string; onChatClick?: () => void }) {
  const configs: Record<string, { icon: string; title: string; subtitle: string; action?: { label: string; onClick?: () => void; href?: string } }> = {
    all: {
      icon: "inbox",
      title: "Your canvas is blank",
      subtitle: "Start building your day. Add a task or let AI create one for you.",
      action: { label: "Create your first task", href: "?tab=all" }
    },
    ai: {
      icon: "smart_toy",
      title: "No AI tasks yet",
      subtitle: "Ask the AI to do something for you. Research, write, edit, or analyze.",
      action: onChatClick ? { label: "Chat with AI", onClick: onChatClick } : undefined
    },
    archive: {
      icon: "archive",
      title: "No completed tasks",
      subtitle: "Your archive is empty. Complete tasks to see them here.",
    },
    default: {
      icon: "task_alt",
      title: "Nothing to show",
      subtitle: "This space is waiting for your input.",
    }
  };

  const config = configs[activeTab] || configs.default;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center border border-[var(--border)]">
          <span className="material-icons text-4xl text-[var(--text-secondary)] opacity-50">{config.icon}</span>
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
          <span className="material-icons text-[14px] text-[var(--text-secondary)] opacity-40">add</span>
        </div>
      </div>
      
      <h3 className="text-[var(--text-primary)] text-lg font-display font-light mb-2">
        {config.title}
      </h3>
      <p className="text-[var(--text-secondary)] text-sm font-light max-w-[280px] leading-relaxed mb-6 opacity-70">
        {config.subtitle}
      </p>

      {config.action && (
        config.action.onClick ? (
          <button
            onClick={config.action.onClick}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-icons text-[16px]">chat</span>
            {config.action.label}
          </button>
        ) : config.action.href ? (
          <button
            onClick={() => {
              // Trigger add task button via custom event
              window.dispatchEvent(new CustomEvent('openAddTask'));
            }}
            className="px-5 py-2.5 rounded-full bg-[var(--text-primary)] text-[var(--background)] text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
          >
            <span className="material-icons text-[16px]">add</span>
            {config.action.label}
          </button>
        ) : null
      )}
    </div>
  );
}

export default function TaskList({ agentFilter = "all", activeTab: activeTabProp, onChatClick }: { agentFilter?: string; activeTab?: string; onChatClick?: () => void }) {
  const searchParams = useSearchParams();
  const activeTab = activeTabProp || searchParams.get("tab") || "today";
  
  const tasksQuery = useQuery(api.tasks.getTasks);
  const isLoading = tasksQuery === undefined;
  const taskList = tasksQuery || [];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  // Build subtask lookup: parentId -> subtasks[]
  const subtasksByParent = new Map<string, Task[]>();
  (taskList as Task[]).forEach((t) => {
    if (t.isSubtask && t.parentTaskId) {
      const existing = subtasksByParent.get(t.parentTaskId) || [];
      existing.push(t);
      subtasksByParent.set(t.parentTaskId, existing);
    }
  });

  const getFilteredTasks = () => {
    // Only show top-level tasks in the main list (subtasks render under their parents)
    let filtered = (taskList as Task[]).filter((t) => !t.isSubtask);
    
    if (agentFilter && agentFilter !== "all") {
      filtered = filtered.filter((t: Task) => t.agent === agentFilter);
    }
    
    switch (activeTab) {
      case "all":
        // Show all tasks except done
        return filtered.filter((t: Task) => t.status !== "done");
      case "ai":
        return filtered.filter((t: Task) => t.isAI);
      case "archive":
        return filtered.filter((t: Task) => t.status === "done");
      default:
        return filtered;
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === "done" ? "inbox" : "done";
    try {
      await updateTaskStatus({ id: task._id as any, status: newStatus } as any);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (confirm("Delete this task?")) {
      try {
        await deleteTask({ id: taskId as any } as any);
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const filteredTasks = getFilteredTasks() as Task[];
  const isDependencyBlocked = (task: Task) => getDependencyBlockers(task, taskList as Task[]).length > 0;
  const activeList = (filteredTasks as Task[]).filter(
    t => (!t.isAI || t.aiStatus !== "blocked") && !isDependencyBlocked(t)
  );
  const pendingTasks = activeList.filter(
    t => t.status === "inbox" && areDependenciesMet(t, taskList as Task[])
  );
  const inProgressTasks = activeList.filter(
    t => t.status === "in_progress" || t.status === "assigned"
  );
  const doneTasks = activeList.filter(t => t.status === "done");
  const blockedTasks = filteredTasks.filter(
    t => t.status !== "done" && ((t.isAI && t.aiStatus === "blocked") || isDependencyBlocked(t))
  );

  // Combine active tasks (pending + in progress) for "Today" section
  const todayTasks = [...inProgressTasks, ...pendingTasks];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[var(--text-secondary)] text-sm font-light opacity-50">Loading tasks...</p>
      </div>
    );
  }

  // Show empty state if no tasks at all
  if (filteredTasks.length === 0) {
    return <EmptyState activeTab={activeTab} onChatClick={onChatClick} />;
  }

  const renderTaskWithSubtasks = (task: Task, props: { isBlocked?: boolean; blockedLabel?: string; dependencyBlockers?: Task[] } = {}) => {
    const subtasks = subtasksByParent.get(task._id) || [];
    return (
      <TaskWithSubtasks
        key={task._id}
        task={task}
        subtasks={subtasks}
        onToggle={handleToggleStatus}
        onDelete={handleDelete}
        allTasks={taskList as Task[]}
        {...props}
      />
    );
  };

  return (
    <div className="space-y-8">
      {/* Today / Active section */}
      {todayTasks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light mb-6 text-[var(--text-primary)]">Today</h2>
          <div>
            {todayTasks.map((task) => renderTaskWithSubtasks(task))}
          </div>
        </div>
      )}

      {/* Blocked section */}
      {blockedTasks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light mb-6 text-[var(--text-primary)] opacity-60">Blocked</h2>
          <div>
            {blockedTasks.map((task) => renderTaskWithSubtasks(task, {
              isBlocked: true,
              blockedLabel: isDependencyBlocked(task) ? "Waiting" : "Blocked",
              dependencyBlockers: getDependencyBlockers(task, taskList as Task[]),
            }))}
          </div>
        </div>
      )}

      {/* Done section */}
      {doneTasks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light mb-6 text-[var(--text-primary)] opacity-30">Done</h2>
          <div>
            {doneTasks.slice(0, 5).map((task) => renderTaskWithSubtasks(task))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskWithSubtasks({ task, subtasks, onToggle, onDelete, allTasks, isBlocked, blockedLabel, dependencyBlockers }: {
  task: Task;
  subtasks: Task[];
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  allTasks: Task[];
  isBlocked?: boolean;
  blockedLabel?: string;
  dependencyBlockers?: Task[];
}) {
  const [showSubtasks, setShowSubtasks] = useState(true);
  const hasSubtasks = subtasks.length > 0;
  const doneCount = subtasks.filter((s) => s.status === "done").length;

  return (
    <div>
      <TaskCard
        task={task}
        onToggle={onToggle}
        onDelete={onDelete}
        isBlocked={isBlocked}
        blockedLabel={blockedLabel}
        dependencyBlockers={dependencyBlockers}
        subtaskCount={hasSubtasks ? subtasks.length : undefined}
        subtaskDoneCount={hasSubtasks ? doneCount : undefined}
        onToggleSubtasks={hasSubtasks ? () => setShowSubtasks(!showSubtasks) : undefined}
        subtasksExpanded={showSubtasks}
      />
      {/* Subtask progress bar */}
      {hasSubtasks && subtasks.length > 0 && (
        <div className="ml-[30px] mt-1 mb-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-[var(--border)]/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500/60 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((doneCount / subtasks.length) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[var(--text-secondary)] opacity-50 font-light">
              {Math.round((doneCount / subtasks.length) * 100)}%
            </span>
          </div>
        </div>
      )}
      {/* Subtask list - indented */}
      {hasSubtasks && showSubtasks && (
        <div className="ml-8 border-l border-[var(--border)]/20 pl-3">
          {subtasks.map((subtask) => (
            <TaskCard
              key={subtask._id}
              task={subtask}
              onToggle={onToggle}
              onDelete={onDelete}
              isBlocked={subtask.aiStatus === "blocked"}
              dependencyBlockers={getDependencyBlockers(subtask, allTasks)}
              isSubtaskCard
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete, isBlocked = false, blockedLabel = "Blocked", dependencyBlockers = [], subtaskCount, subtaskDoneCount, onToggleSubtasks, subtasksExpanded, isSubtaskCard = false }: { 
  task: Task; 
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  isBlocked?: boolean;
  blockedLabel?: string;
  dependencyBlockers?: Task[];
  subtaskCount?: number;
  subtaskDoneCount?: number;
  onToggleSubtasks?: () => void;
  subtasksExpanded?: boolean;
  isSubtaskCard?: boolean;
}) {
  const agentInfo = getAgentInfo(task.agent);
  const [expanded, setExpanded] = useState(false);
  const isDone = task.status === "done";
  const blockerNames = dependencyBlockers.map((dep) => dep.title).slice(0, 3);
  const hasDependencyBlockers = dependencyBlockers.length > 0;

  const priorityConfig = task.priority === "high" 
    ? { dot: "bg-red-500", pill: "bg-red-500/10 text-red-500", label: "High" }
    : task.priority === "medium"
    ? { dot: "bg-amber-500", pill: "bg-amber-500/10 text-amber-500", label: "Medium" }
    : task.priority === "low"
    ? { dot: "bg-[var(--text-secondary)]/30", pill: "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]", label: "Low" }
    : null;

  return (
    <div 
      className={`group ${isSubtaskCard ? "py-2.5" : "py-4"} border-b border-[var(--border)]/30 transition-opacity ${
        isDone ? "opacity-50" : isBlocked ? "opacity-90" : ""
      }`}
    >
      {/* Row 1: Checkbox + Title + Priority dot + Actions + Time */}
      <div className="flex items-center gap-3">
        {/* Circle checkbox */}
        <button
          onClick={() => onToggle(task)}
          className={`${isSubtaskCard ? "w-[15px] h-[15px]" : "w-[18px] h-[18px]"} rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
            isDone
              ? "bg-[var(--text-primary)] border-[var(--text-primary)]"
              : "border-[var(--text-secondary)]/40 group-hover:border-[var(--text-primary)]"
          }`}
        >
          {isDone && (
            <span className={`material-icons text-[var(--background)] ${isSubtaskCard ? "text-[10px]" : "text-[12px]"}`}>check</span>
          )}
        </button>

        {/* Title + expand */}
        <div 
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <p 
            className={`${isSubtaskCard ? "text-[13px]" : "text-[15px]"} font-normal leading-tight truncate ${
              isDone ? "text-[var(--text-secondary)] line-through opacity-60" : "text-[var(--text-primary)]"
            }`}
          >
            {task.title}
          </p>
        </div>

        {/* Right cluster: priority dot + blocked dot + action icons + time */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Priority indicator dot */}
          {priorityConfig && !isDone && (
            <div className={`w-1.5 h-1.5 rounded-full ${priorityConfig.dot} flex-shrink-0`} title={`${priorityConfig.label} priority`}></div>
          )}

          {/* Blocked indicator */}
          {isBlocked && (
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-glow-red animate-pulse flex-shrink-0"></div>
          )}

          {/* View AI work - always visible for AI tasks with responses */}
          {task.isAI && task.aiResponse && (
            <Link
              href={`/ai-work?task=${task._id}`}
              className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0"
              title="View AI work"
            >
              <span className="material-icons text-[16px] text-[var(--text-secondary)]">open_in_new</span>
            </Link>
          )}

          {/* Delete - hover reveal */}
          <button
            onClick={() => onDelete(task._id)}
            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:!text-red-500 transition-all flex-shrink-0 text-[var(--text-secondary)]"
            title="Delete task"
          >
            <span className="material-icons text-[16px]">delete_outline</span>
          </button>

          {/* Time / Blocked label */}
          <span className={`text-xs font-light min-w-[3ch] text-right ${
            isBlocked ? "text-red-500/70" : "text-[var(--text-secondary)] opacity-40"
          }`}>
            {isBlocked ? blockedLabel : getRelativeTime(task.createdAt)}
          </span>
        </div>
      </div>

      {/* Row 2: Metadata pills (agent, AI, tags, AI status) */}
      <div className={`${isSubtaskCard ? "ml-[26px]" : "ml-[30px]"} mt-1.5`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* AI pill */}
          {task.isAI && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--text-primary)] text-[var(--background)]">
              AI
            </span>
          )}

          {/* AI Created tag - shown when an agent created this task */}
          {task.createdBy && task.createdBy !== "user" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20">
              AI Created
            </span>
          )}

          {/* Heartbeat agent assignment - shown on delegated subtasks */}
          {task.heartbeatAgentId && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex items-center gap-0.5">
              <span className="material-icons text-[10px]">schedule</span>
              {getAgentInfo(task.heartbeatAgentId)?.emoji} Heartbeat
            </span>
          )}

          {/* Subtask mode indicator - shown on parent tasks with subtasks */}
          {task.subtaskMode && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
              {task.subtaskMode === "parallel" ? "Parallel" : "Serial"}
            </span>
          )}

          {/* Agent pill */}
          {agentInfo && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
              task.agent === "researcher" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
              task.agent === "writer" ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
              task.agent === "editor" ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
              task.agent === "coordinator" ? "bg-teal-500/10 text-teal-500 border-teal-500/20" :
              "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)]"
            }`}>
              {agentInfo.emoji} {agentInfo.name}
            </span>
          )}

          {/* Priority pill */}
          {priorityConfig && !isDone && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${priorityConfig.pill}`}>
              {priorityConfig.label}
            </span>
          )}

          {/* Custom tags */}
          {task.tags && task.tags.map((tag) => (
            <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
              {tag}
            </span>
          ))}

          {/* Due date inline */}
          {task.dueDate && (
            <span className="text-[10px] text-[var(--text-secondary)] font-light opacity-60 flex items-center gap-0.5">
              <span className="material-icons text-[10px]">event</span>
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          )}

          {/* AI status inline */}
          {task.isAI && task.aiStatus && !isDone && (
            <>
              {task.aiStatus === "running" && (
                <span className="flex items-center gap-1 ml-1">
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                  <span className="text-[10px] text-[var(--text-secondary)] font-light opacity-60">Working</span>
                </span>
              )}
              {task.aiStatus === "completed" && (
                <span className="text-[10px] text-[var(--text-secondary)] font-light flex items-center gap-0.5 opacity-60 ml-1">
                  <span className="material-icons text-[10px] text-green-500">check_circle</span>
                  Done
                  {task.aiStartedAt && task.aiCompletedAt && (
                    <span className="opacity-50"> · {formatDuration(task.aiCompletedAt - task.aiStartedAt)}</span>
                  )}
                </span>
              )}
              {task.aiStatus === "failed" && (
                <span className="text-[10px] text-red-400 font-light flex items-center gap-0.5 ml-1">
                  <span className="material-icons text-[10px]">error</span>
                  Failed
                  {task.aiStartedAt && task.aiCompletedAt && (
                    <span className="opacity-50"> · {formatDuration(task.aiCompletedAt - task.aiStartedAt)}</span>
                  )}
                </span>
              )}
              {task.aiStatus === "blocked" && !hasDependencyBlockers && (
                <span className="text-[10px] text-red-400 font-light flex items-center gap-0.5 ml-1">
                  <span className="material-icons text-[10px]">block</span>
                  Blocked
                </span>
              )}
            </>
          )}

          {/* Subtask counter + toggle */}
          {subtaskCount !== undefined && subtaskCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSubtasks?.(); }}
              className="text-[10px] text-[var(--text-secondary)] font-light flex items-center gap-0.5 opacity-60 hover:opacity-100 transition-opacity ml-1"
            >
              <span className="material-icons text-[10px]">{subtasksExpanded ? "expand_less" : "expand_more"}</span>
              {subtaskDoneCount}/{subtaskCount} subtasks
            </button>
          )}
        </div>

        {/* Dependency blockers - compact inline */}
        {hasDependencyBlockers && !isDone && (
          <p className="mt-1 text-[11px] text-red-400 font-light flex items-center gap-1.5">
            <span className="material-icons text-[12px]">hourglass_top</span>
            Waiting on {blockerNames.join(", ")}
            {dependencyBlockers.length > blockerNames.length ? "..." : ""}
          </p>
        )}

        {/* AI Short Summary - inline preview */}
        {task.isAI && task.aiResponseShort && (
          <p className="mt-1 text-[12px] text-[var(--text-secondary)] font-light leading-snug line-clamp-2 opacity-80">
            {task.aiResponseShort}
          </p>
        )}

        {/* Expanded details */}
        {expanded && (
          <div className="mt-2 space-y-2 pb-1">
            {task.description && (
              <p className="text-sm text-[var(--text-secondary)] font-light leading-relaxed">{task.description}</p>
            )}

            {hasDependencyBlockers && (
              <div className="text-[11px] text-red-400 font-light flex items-center gap-2">
                <span className="material-icons text-[12px]">hourglass_top</span>
                Waiting on {dependencyBlockers.map((dep) => dep.title).join(", ")}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expand/collapse toggle bar */}
      {(task.description || hasDependencyBlockers) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-[30px] mt-1 flex items-center gap-1 text-[11px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity"
        >
          <span className={`material-icons text-[14px] transition-transform ${expanded ? "rotate-180" : ""}`}>
            expand_more
          </span>
          {expanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
