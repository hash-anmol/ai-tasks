"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useGamification } from "@/hooks/useGamification";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done";
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

interface TaskListProps {
  agentFilter?: string;
}

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

// Get dependency titles for display
const getDependencyTitles = (task: Task, allTasks: Task[]): string[] => {
  if (!task.dependsOn || task.dependsOn.length === 0) return [];
  return task.dependsOn
    .map(depId => {
      const depTask = allTasks.find(t => t._id === depId);
      return depTask?.status !== "done" ? depTask?.title : null;
    })
    .filter(Boolean) as string[];
};

const initialTasks: Task[] = [
  {
    _id: "1",
    title: "Review Q3 Design Specs",
    status: "done",
    priority: "high",
    tags: ["AI"],
    isAI: true,
    agent: "researcher",
    aiProgress: 100,
    aiNotes: "Completed analysis of design specifications. All items approved.",
    aiStatus: "completed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "2",
    title: "Synthesize Meeting Notes",
    status: "pending",
    dueDate: "2:30 PM",
    priority: "medium",
    tags: [],
    isAI: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "3",
    title: "Generate Project Roadmap",
    status: "in_progress",
    tags: ["AI"],
    isAI: true,
    agent: "coordinator",
    aiProgress: 65,
    aiNotes: "Analyzing requirements and creating milestone structure...",
    aiStatus: "working",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "4",
    title: "Email Marketing Team",
    description: "Regarding the launch campaign assets",
    status: "pending",
    priority: "medium",
    tags: [],
    isAI: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: "5",
    title: "Update Sprint Backlog",
    status: "pending",
    priority: "medium",
    tags: [],
    isAI: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function TaskListContent({ agentFilter = "all" }: TaskListProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showReward, setShowReward] = useState<{coins: number; xp: number} | null>(null);
  const { completeTask } = useGamification();
  const searchParams = useSearchParams();
  
  const activeTab = searchParams.get("tab") || "today";

  // Filter tasks based on tab
  const getFilteredTasks = () => {
    let filtered = tasks;
    
    // Filter by agent if set
    if (agentFilter && agentFilter !== "all") {
      filtered = filtered.filter((t) => t.agent === agentFilter);
    }
    
    switch (activeTab) {
      case "inbox":
        return filtered.filter((t) => t.status === "pending");
      case "ai":
        return filtered.filter((t) => t.isAI);
      case "archive":
        return filtered.filter((t) => t.status === "done");
      default:
        return filtered;
    }
  };

  const filteredTasks = getFilteredTasks();

  useEffect(() => {
    const stored = localStorage.getItem("ai-tasks");
    if (stored) {
      setTasks(JSON.parse(stored));
    } else {
      setTasks(initialTasks);
      localStorage.setItem("ai-tasks", JSON.stringify(initialTasks));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && tasks.length > 0) {
      localStorage.setItem("ai-tasks", JSON.stringify(tasks));
    }
  }, [tasks, isLoading]);

  const toggleTaskStatus = (taskId: string) => {
    const task = tasks.find(t => t._id === taskId);
    if (!task) return;
    
    // Check dependencies before marking as done
    if (task.status !== "done" && !areDependenciesMet(task, tasks)) {
      return; // Can't complete blocked task
    }
    
    setTasks((prev) =>
      prev.map((task) => {
        if (task._id === taskId) {
          const newStatus = task.status === "done" ? "pending" : "done";
          if (newStatus === "done" && task.status !== "done") {
            const reward = completeTask();
            setShowReward({ coins: reward.coinsEarned, xp: reward.xpEarned });
            setTimeout(() => setShowReward(null), 2000);
          }
          return {
            ...task,
            status: newStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return task;
      })
    );
  };

  const completedCount = filteredTasks.filter((t) => t.status === "done").length;
  const totalCount = filteredTasks.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading tasks...</div>
      </div>
    );
  }

  const pendingTasks = filteredTasks.filter((t) => t.status !== "done");
  const doneTasks = filteredTasks.filter((t) => t.status === "done");

  return (
    <>
      {showReward && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-coin-pop">
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center border-2 border-primary">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-2xl font-bold text-slate-800">+{showReward.coins} 🪙</div>
            <div className="text-sm text-slate-500">+{showReward.xp} XP</div>
          </div>
        </div>
      )}

      {pendingTasks.length === 0 && doneTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <span className="material-icons text-4xl text-slate-300 mb-2">inbox</span>
          <p className="text-slate-400">No tasks in {activeTab}</p>
        </div>
      ) : (
        <>
          {/* Pending Tasks */}
          {pendingTasks.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">
                {activeTab === "ai" ? "AI Tasks" : activeTab === "inbox" ? "Inbox" : activeTab === "archive" ? "Archived" : "Next Steps"}
              </h2>
              {pendingTasks.map((task) => (
                <div key={task._id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 pt-1">
                      <button
                        onClick={() => toggleTaskStatus(task._id)}
                        className="w-6 h-6 rounded-full border-2 border-slate-200 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                      >
                        <span className="material-icons text-slate-300 text-sm">circle</span>
                      </button>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-semibold text-[15px] ${!areDependenciesMet(task, tasks) ? 'text-slate-400' : 'text-slate-800'}`}>
                          {task.title}
                        </h3>
                        <div className="flex items-center gap-1">
                          {!areDependenciesMet(task, tasks) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                              🔒 Blocked
                            </span>
                          )}
                          {task.agent && (
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getAgentInfo(task.agent)?.color || 'bg-slate-500'} text-white uppercase tracking-wide`}>
                              {getAgentInfo(task.agent)?.emoji} {getAgentInfo(task.agent)?.name}
                            </span>
                          )}
                          {task.isAI && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-slate-900 uppercase tracking-wide">
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                      {!areDependenciesMet(task, tasks) && (
                        <div className="mt-2 p-2 bg-red-50 rounded-lg">
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <span className="material-icons text-xs">block</span>
                            Waiting on: {getDependencyTitles(task, tasks).join(", ")}
                          </p>
                        </div>
                      )}
                      {task.isAI && task.aiProgress !== undefined && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500">AI Progress</span>
                            <span className="font-medium text-primary">{task.aiProgress}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full" style={{ width: `${task.aiProgress}%` }} />
                          </div>
                        </div>
                      )}
                      {task.isAI && task.aiStatus && (
                        <div className="mt-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            task.aiStatus === 'assigned' ? 'bg-blue-100 text-blue-700' : 
                            task.aiStatus === 'working' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {task.aiStatus === 'assigned' ? '🤖 Assigned' : task.aiStatus === 'working' ? '⚡ AI Working' : '✅ Done'}
                          </span>
                        </div>
                      )}
                      {task.isAI && task.aiStatus === 'working' && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex gap-0.5">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span className="text-xs text-primary">AI thinking...</span>
                        </div>
                      )}
                      {task.isAI && task.aiNotes && (
                        <div className="mt-2 p-2 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-600 italic">"{task.aiNotes}"</p>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {task.dueDate && (
                          <div className="flex items-center text-slate-400 gap-1">
                            <span className="material-icons text-sm">schedule</span>
                            <span className="text-xs">{task.dueDate}</span>
                          </div>
                        )}
                        {task.priority && (
                          <div className="flex items-center text-slate-400 gap-1">
                            <span className="material-icons text-sm">flag</span>
                            <span className="text-xs capitalize">{task.priority}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed Tasks */}
          {doneTasks.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Completed</h2>
              {doneTasks.map((task) => (
                <div key={task._id} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 mb-3 opacity-60">
                  <div className="flex-shrink-0">
                    <button
                      onClick={() => toggleTaskStatus(task._id)}
                      className="w-6 h-6 rounded border-2 border-primary flex items-center justify-center bg-primary/10"
                    >
                      <span className="material-icons text-primary text-lg font-bold">check</span>
                    </button>
                  </div>
                  <div className="flex-grow">
                    <h3 className="font-semibold text-slate-800 text-[15px] line-through">{task.title}</h3>
                    <div className="flex items-center gap-2">
                      {task.isAI && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-emerald-700">AI</span>}
                      <span className="text-xs text-slate-400">Completed</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function TaskList({ agentFilter = "all" }: TaskListProps) {
  return (
    <Suspense fallback={<div className="text-center py-12 text-slate-400">Loading...</div>}>
      <TaskListContent agentFilter={agentFilter} />
    </Suspense>
  );
}
