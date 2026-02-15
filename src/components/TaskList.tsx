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
  aiResponse?: string;
  aiResponseShort?: string;
  aiBlockers?: string[];
  openclawSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

const AGENTS: Record<string, { name: string; emoji: string; color: string }> = {
  researcher: { name: "Scout", emoji: "🔍", color: "text-blue-500/80" },
  writer: { name: "Writer", emoji: "✍️", color: "text-purple-500/80" },
  editor: { name: "Editor", emoji: "📝", color: "text-orange-500/80" },
  coordinator: { name: "Nexus AI", emoji: "⚡", color: "text-teal-500/80" },
};

const getAgentInfo = (agentId?: string) => agentId ? AGENTS[agentId] : undefined;

const areDependenciesMet = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependsOn || task.dependsOn.length === 0) return true;
  return task.dependsOn.every(depId => {
    const depTask = allTasks.find(t => t._id === depId);
    return depTask?.status === "done";
  });
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

export default function TaskList({ agentFilter = "all", activeTab: activeTabProp }: { agentFilter?: string; activeTab?: string }) {
  const searchParams = useSearchParams();
  const activeTab = activeTabProp || searchParams.get("tab") || "today";
  
  const tasksQuery = useQuery(api.tasks.getTasks);
  const isLoading = tasksQuery === undefined;
  const taskList = tasksQuery || [];
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const getFilteredTasks = () => {
    let filtered = taskList as Task[];
    
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
  const activeList = (filteredTasks as Task[]).filter(
    t => !t.isAI || t.aiStatus !== "blocked"
  );
  const pendingTasks = activeList.filter(
    t => t.status === "inbox" && areDependenciesMet(t, taskList as Task[])
  );
  const inProgressTasks = activeList.filter(
    t => t.status === "in_progress" || t.status === "assigned"
  );
  const doneTasks = activeList.filter(t => t.status === "done");
  const blockedTasks = filteredTasks.filter(
    t => t.isAI && t.aiStatus === "blocked"
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

  return (
    <div className="space-y-8">
      {/* Today / Active section */}
      {todayTasks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light mb-6 text-[var(--text-primary)]">Today</h2>
          <div>
            {todayTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Blocked section */}
      {blockedTasks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light mb-6 text-[var(--text-primary)] opacity-60">Blocked</h2>
          <div>
            {blockedTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
                isBlocked
              />
            ))}
          </div>
        </div>
      )}

      {/* Done section */}
      {doneTasks.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-light mb-6 text-[var(--text-primary)] opacity-30">Done</h2>
          <div>
            {doneTasks.slice(0, 5).map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onToggle={handleToggleStatus}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {filteredTasks.length === 0 && (
        <div className="text-center py-20 opacity-30">
          <span className="material-icons text-4xl text-[var(--text-secondary)]">task_alt</span>
          <p className="text-[var(--text-secondary)] mt-3 text-sm font-light">No tasks yet</p>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete, isBlocked = false }: { 
  task: Task; 
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
  isBlocked?: boolean;
}) {
  const agentInfo = getAgentInfo(task.agent);
  const [expanded, setExpanded] = useState(false);
  const isDone = task.status === "done";

  return (
    <div 
      className={`group py-4 border-b border-[var(--border)]/30 flex items-start justify-between transition-opacity ${
        isDone ? "opacity-50" : isBlocked ? "opacity-90" : ""
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {/* Circle checkbox */}
        <button
          onClick={() => onToggle(task)}
          className={`mt-0.5 w-[18px] h-[18px] rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
            isDone
              ? "bg-[var(--text-primary)] border-[var(--text-primary)]"
              : "border-[var(--text-secondary)]/40 group-hover:border-[var(--text-primary)]"
          }`}
        >
          {isDone && (
            <span className="material-icons text-[var(--background)] text-[12px]">check</span>
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div 
            className="flex items-center gap-2 mb-0.5 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {/* AI icon - only shown for AI tasks */}
            {task.isAI && (
              <span className="material-icons text-[16px] text-[var(--text-secondary)] flex-shrink-0 opacity-60">smart_toy</span>
            )}
            <p 
              className={`text-[15px] font-normal leading-tight flex-1 ${
                isDone ? "text-[var(--text-secondary)] line-through opacity-60" : "text-[var(--text-primary)]"
              }`}
            >
              {task.title}
            </p>
            {isBlocked && (
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-glow-red animate-pulse flex-shrink-0"></div>
            )}
            {/* Expand chevron */}
            <span className={`material-icons text-[16px] text-[var(--text-secondary)] flex-shrink-0 transition-transform opacity-40 ${
              expanded ? "rotate-180" : ""
            }`}>
              expand_more
            </span>
          </div>

          {/* Tag pills row */}
          {(agentInfo || task.isAI || (task.tags && task.tags.length > 0)) && (
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {task.isAI && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--text-primary)] text-[var(--background)]">
                  AI
                </span>
              )}
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
              {task.tags && task.tags.map((tag) => (
                <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* AI Status indicator */}
          {task.isAI && task.aiStatus && !isDone && (
            <div className="mt-1.5 flex items-center gap-1.5">
              {task.aiStatus === "running" && (
                <>
                  <div className="flex gap-0.5">
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)] font-light opacity-60">Working...</span>
                </>
              )}
              {task.aiStatus === "completed" && (
                <span className="text-[11px] text-[var(--text-secondary)] font-light flex items-center gap-1 opacity-60">
                  <span className="material-icons text-[11px] text-green-500">check_circle</span>
                  Done
                </span>
              )}
            </div>
          )}

          {/* AI Short Summary - inline preview */}
          {task.isAI && task.aiResponseShort && (
            <p className="mt-1 text-[12px] text-[var(--text-secondary)] font-light leading-snug line-clamp-2 opacity-80">
              {task.aiResponseShort}
            </p>
          )}

          {/* Expanded details */}
          {expanded && (
            <div className="mt-2 space-y-2">
              {task.description && (
                <p className="text-sm text-[var(--text-secondary)] font-light leading-relaxed">{task.description}</p>
              )}

              {/* Priority + Due date */}
              <div className="flex items-center gap-2">
                {task.priority && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    task.priority === "high" ? "bg-red-500/10 text-red-500" :
                    task.priority === "medium" ? "bg-amber-500/10 text-amber-500" :
                    "bg-[var(--surface)] text-[var(--text-secondary)] border border-[var(--border)]"
                  }`}>
                    {task.priority}
                  </span>
                )}
                {task.dueDate && (
                  <span className="text-[10px] text-[var(--text-secondary)] font-light opacity-60">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Link to full AI work details */}
              {task.isAI && task.aiResponse && (
                <Link
                  href={`/ai-work?task=${task._id}`}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-light"
                >
                  <span className="material-icons text-[12px]">open_in_new</span>
                  View full AI work
                </Link>
              )}

              {/* Delete action */}
              <button
                onClick={() => onDelete(task._id)}
                className="text-[11px] text-[var(--text-secondary)] hover:text-red-500 transition-colors font-light opacity-40 hover:opacity-100"
              >
                Delete task
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right side - time indicator */}
      <span className={`text-xs font-light flex-shrink-0 ml-3 ${
        isBlocked ? "text-red-500/70" : "text-[var(--text-secondary)] opacity-40"
      }`}>
        {isBlocked ? "Blocked" : getRelativeTime(task.createdAt)}
      </span>
    </div>
  );
}
