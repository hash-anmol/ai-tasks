"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

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
  
  // Get tasks from REST API
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

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
    try {
      await fetch(`/api/tasks?id=${task._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTasks();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const handleDelete = async (taskId: string) => {
    if (confirm("Delete this task?")) {
      try {
        await fetch(`/api/tasks?id=${taskId}`, { method: 'DELETE' });
        fetchTasks();
      } catch (error) {
        console.error("Error deleting task:", error);
      }
    }
  };

  const filteredTasks = getFilteredTasks();
  const pendingTasks = filteredTasks.filter(t => t.status === "pending" && areDependenciesMet(t, tasks));
  const inProgressTasks = filteredTasks.filter(t => t.status === "in_progress");
  const doneTasks = filteredTasks.filter(t => t.status === "done");

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Loading tasks...</div>;
  }

  return (
    <div className="space-y-6">
      {pendingTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            To Do ({pendingTasks.length})
          </h3>
          <div className="space-y-2">
            {pendingTasks.map((task) => (
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

      {inProgressTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            In Progress ({inProgressTasks.length})
          </h3>
          <div className="space-y-2">
            {inProgressTasks.map((task) => (
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

      {doneTasks.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Done ({doneTasks.length})
          </h3>
          <div className="space-y-2">
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
        <div className="text-center py-12">
          <span className="material-icons text-4xl text-slate-300">task_alt</span>
          <p className="text-slate-500 mt-2">No tasks yet</p>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete }: { 
  task: Task; 
  onToggle: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const agentInfo = getAgentInfo(task.agent);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-xl p-4 shadow-sm border-l-4 ${
      task.status === "done" ? "border-green-500 opacity-60" :
      task.status === "in_progress" ? "border-yellow-500" :
      "border-primary"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <button
            onClick={() => onToggle(task)}
            className={`mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
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
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={`font-medium text-slate-800 ${task.status === "done" ? "line-through" : ""}`}>
                {task.title}
              </h4>
              {task.isAI && (
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="material-icons text-[10px]">smart_toy</span>
                  AI
                </span>
              )}
              {agentInfo && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${agentInfo.color} text-white`}>
                  {agentInfo.emoji} {agentInfo.name}
                </span>
              )}
            </div>
            
            {task.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>
            )}

            {/* AI Progress */}
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
              </div>
            )}

            {/* AI Response */}
            {task.aiResponse && (
              <details className="mt-2">
                <summary className="text-xs text-slate-500 cursor-pointer">View AI Response</summary>
                <pre className="mt-1 p-2 bg-slate-50 rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {task.aiResponse}
                </pre>
              </details>
            )}
            
            <div className="flex items-center gap-2 mt-2">
              {task.priority && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  task.priority === "high" ? "bg-red-100 text-red-600" :
                  task.priority === "medium" ? "bg-yellow-100 text-yellow-600" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {task.priority}
                </span>
              )}
              {task.dueDate && (
                <span className="text-[10px] text-slate-400">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <button
          onClick={() => onDelete(task._id)}
          className="p-1 text-slate-400 hover:text-red-500"
        >
          <span className="material-icons text-sm">delete</span>
        </button>
      </div>
    </div>
  );
}
