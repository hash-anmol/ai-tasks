"use client";

import { useState, useEffect } from "react";
import { useGamification } from "@/hooks/useGamification";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  tags: string[];
  isAI: boolean;
  agent?: "researcher" | "writer" | "editor" | "coordinator";
  dependsOn?: string[];
  aiProgress?: number;
  aiNotes?: string;
  aiStatus?: "assigned" | "working" | "completed";
  openclawTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "inbox", label: "Inbox", color: "bg-slate-500" },
  { id: "assigned", label: "Assigned", color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress", color: "bg-yellow-500" },
  { id: "review", label: "Review", color: "bg-purple-500" },
  { id: "done", label: "Done", color: "bg-green-500" },
];

const AGENTS = [
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500" },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500" },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500" },
];

const getAgentInfo = (agentId?: string) => AGENTS.find(a => a.id === agentId);

// Check if all dependencies are completed
const areDependenciesMet = (task: Task, allTasks: Task[]): boolean => {
  if (!task.dependsOn || task.dependsOn.length === 0) return true;
  return task.dependsOn.every(depId => {
    const depTask = allTasks.find(t => t._id === depId);
    return depTask?.status === "done";
  });
};

export default function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const { completeTask } = useGamification();

  useEffect(() => {
    const stored = localStorage.getItem("ai-tasks");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old status to new format
      const migrated = parsed.map((t: any) => ({
        ...t,
        status: t.status === "pending" ? "inbox" : t.status === "done" ? "done" : t.status || "inbox"
      }));
      setTasks(migrated);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem("ai-tasks", JSON.stringify(tasks));
    }
  }, [tasks, isLoading]);

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (columnId: TaskStatus) => {
    if (!draggedTask) return;
    
    const task = tasks.find(t => t._id === draggedTask);
    if (!task) return;
    
    // Prevent moving to done if dependencies aren't met
    if (columnId === "done" && !areDependenciesMet(task, tasks)) {
      setDraggedTask(null);
      return;
    }
    
    setTasks(prev => prev.map(task => {
      if (task._id === draggedTask) {
        const wasDone = task.status === "done";
        const nowDone = columnId === "done";
        if (!wasDone && nowDone) {
          completeTask();
        }
        return { ...task, status: columnId, updatedAt: new Date().toISOString() };
      }
      return task;
    }));
    setDraggedTask(null);
  };

  const getTasksByColumn = (columnId: TaskStatus) => {
    return tasks.filter(t => t.status === columnId);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-5 px-5">
      {COLUMNS.map(column => (
        <div
          key={column.id}
          className="flex-shrink-0 w-72"
          onDragOver={handleDragOver}
          onDrop={() => handleDrop(column.id)}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${column.color}`}></div>
            <h3 className="font-semibold text-sm">{column.label}</h3>
            <span className="text-xs text-slate-400">({getTasksByColumn(column.id).length})</span>
          </div>
          
          <div className="space-y-2 min-h-[200px] bg-slate-50 rounded-xl p-2">
            {getTasksByColumn(column.id).map(task => (
              <div
                key={task._id}
                draggable={areDependenciesMet(task, tasks)}
                onDragStart={() => handleDragStart(task._id)}
                className={`bg-white rounded-lg p-3 shadow-sm border border-slate-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
                  draggedTask === task._id ? "opacity-50" : ""
                } ${!areDependenciesMet(task, tasks) ? 'opacity-60 border-l-4 border-l-red-400' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className={`font-medium text-sm ${!areDependenciesMet(task, tasks) ? 'text-slate-400' : 'text-slate-800'}`}>
                    {task.title}
                  </h4>
                  <div className="flex gap-1 flex-shrink-0">
                    {!areDependenciesMet(task, tasks) && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-red-100 text-red-700 font-bold">🔒</span>
                    )}
                    {task.agent && (
                      <span className="text-xs">{getAgentInfo(task.agent)?.emoji}</span>
                    )}
                    {task.isAI && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary font-bold">AI</span>
                    )}
                  </div>
                </div>
                
                {task.isAI && task.aiProgress !== undefined && (
                  <div className="mt-2">
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full" 
                        style={{ width: `${task.aiProgress}%` }}
                      />
                    </div>
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
                      {task.dueDate}
                    </span>
                  )}
                </div>
              </div>
            ))}
            
            {getTasksByColumn(column.id).length === 0 && (
              <div className="text-center py-8 text-slate-300 text-sm">
                No tasks
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
