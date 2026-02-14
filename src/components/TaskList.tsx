"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

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
  openclawSessionId?: string;
  createdAt: number;
  updatedAt: number;
}

const AGENTS = [
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500" },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500" },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500" },
];

const getAgentInfo = (agentId?: string) => AGENTS.find(a => a.id === agentId);

const areDependenciesMet = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependsOn || task.dependsOn.length === 0) return true;
  return task.dependsOn.every(depId => {
    const depTask = allTasks.find(t => t._id === depId);
    return depTask?.status === "done";
  });
};

export default function TaskList({ agentFilter = "all" }: { agentFilter?: string }) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "today";
  
  // Get tasks from Convex
  const tasks = useQuery(api.tasks.getTasks) || [];
  const updateStatus = useMutation(api.tasks.updateTaskStatus);
  const deleteTask = useMutation(api.tasks.deleteTask);

  const getFilteredTasks = () => {
    let filtered = tasks;
    
    if (agentFilter && agentFilter !== "all") {
      filtered = filtered.filter((t: Task) => t.agent === agentFilter);
    }
    
    switch (activeTab) {
      case "inbox":
        return filtered.filter((t: Task) => t.status === "pending");
      case "ai":
        return filtered.filter((t: Task) => t.isAI);
      case "archive":
        return filtered.filter((t: Task) => t.status === "done");
      default:
        return filtered;
    }
  };

  const handleToggleStatus = async (task: Task) => {
    const newStatus = task.status === "done" ? "pending" : "done";
    await updateStatus({ id: task._id as any, status: newStatus });
  };

  const handleDelete = async (taskId: string) => {
    if (confirm("Delete this task?")) {
      await deleteTask({ id: taskId as any });
    }
  };

  const filteredTasks = getFilteredTasks();

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="material-icons text-3xl text-slate-300">check_circle</span>
        </div>
        <h3 className="font-semibold text-slate-600 mb-1">No tasks yet</h3>
        <p className="text-sm text-slate-400">Tap + to create your first task</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredTasks.map((task: Task) => (
        <div
          key={task._id}
          className={`bg-white rounded-xl p-4 shadow-sm border border-slate-100 ${
            task.status === "done" ? "opacity-60" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <button
              onClick={() => handleToggleStatus(task)}
              className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                task.status === "done"
                  ? "bg-green-500 border-green-500"
                  : "border-slate-300 hover:border-primary"
              }`}
            >
              {task.status === "done" && (
                <span className="material-icons text-white text-sm">check</span>
              )}
            </button>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className={`font-medium text-slate-800 truncate ${
                  task.status === "done" ? "line-through text-slate-400" : ""
                }`}>
                  {task.title}
                </h4>
                {task.isAI && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold flex-shrink-0">
                    AI
                  </span>
                )}
                {task.agent && (
                  <span className="text-sm flex-shrink-0">
                    {getAgentInfo(task.agent)?.emoji}
                  </span>
                )}
              </div>
              
              {task.description && (
                <p className="text-sm text-slate-500 line-clamp-2 mb-2">
                  {task.description}
                </p>
              )}

              {/* AI Progress Bar */}
              {task.isAI && task.aiProgress !== undefined && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>AI Progress</span>
                    <span>{task.aiProgress}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all"
                      style={{ width: `${task.aiProgress}%` }}
                    />
                  </div>
                  {task.aiStatus === "running" && (
                    <p className="text-xs text-primary mt-1 flex items-center gap-1">
                      <span className="animate-pulse">●</span> AI is working...
                    </p>
                  )}
                  {task.aiResponse && (
                    <details className="mt-2">
                      <summary className="text-xs text-slate-500 cursor-pointer hover:text-primary">
                        View AI Response
                      </summary>
                      <pre className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                        {task.aiResponse}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2">
                {task.priority && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    task.priority === "high" ? "bg-red-100 text-red-700" :
                    task.priority === "medium" ? "bg-yellow-100 text-yellow-700" :
                    "bg-slate-100 text-slate-600"
                  }`}>
                    {task.priority}
                  </span>
                )}
                {task.dueDate && (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <span className="material-icons text-xs">schedule</span>
                    {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => handleDelete(task._id)}
              className="text-slate-300 hover:text-red-500"
            >
              <span className="material-icons text-sm">delete</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
