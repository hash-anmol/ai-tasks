"use client";

import { useState, useEffect } from "react";
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
  // AI-specific fields
  aiProgress?: number; // 0-100
  aiNotes?: string;
  aiStatus?: "assigned" | "working" | "completed";
  openclawTaskId?: string;
  createdAt: string;
  updatedAt: string;
}

// Initial demo tasks
const initialTasks: Task[] = [
  {
    _id: "1",
    title: "Review Q3 Design Specs",
    status: "done",
    priority: "high",
    tags: ["AI"],
    isAI: true,
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

export default function TaskList() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showReward, setShowReward] = useState<{coins: number; xp: number} | null>(null);
  const { completeTask } = useGamification();

  // Load tasks from localStorage on mount
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

  // Save to localStorage whenever tasks change
  useEffect(() => {
    if (!isLoading && tasks.length > 0) {
      localStorage.setItem("ai-tasks", JSON.stringify(tasks));
    }
  }, [tasks, isLoading]);

  const toggleTaskStatus = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task._id === taskId) {
          const newStatus = task.status === "done" ? "pending" : "done";
          // If marking as done, trigger gamification
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

  const completedCount = tasks.filter((t) => t.status === "done").length;
  const totalCount = tasks.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading tasks...</div>
      </div>
    );
  }

  return (
    <>
      {/* Reward Popup */}
      {showReward && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 animate-coin-pop">
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center border-2 border-primary">
            <div className="text-4xl mb-2">🎉</div>
            <div className="text-2xl font-bold text-slate-800">+{showReward.coins} 🪙</div>
            <div className="text-sm text-slate-500">+{showReward.xp} XP</div>
          </div>
        </div>
      )}

      {/* Section: Priority */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">Priority</h2>

        {/* Completed AI Task */}
        {tasks
          .filter((t) => t.status === "done" && t.isAI)
          .map((task) => (
            <div
              key={task._id}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 mb-3"
            >
              <div className="flex-shrink-0">
                <button
                  onClick={() => toggleTaskStatus(task._id)}
                  className="w-6 h-6 rounded border-2 border-primary flex items-center justify-center bg-primary/10"
                >
                  <span className="material-icons text-primary text-lg font-bold">check</span>
                </button>
              </div>
              <div className="flex-grow">
                <h3 className="font-semibold text-slate-800 text-[15px] line-through opacity-50">
                  {task.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary/20 text-emerald-700 uppercase tracking-wide">
                    AI
                  </span>
                  <span className="text-xs text-slate-400">Completed</span>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Section: Next Steps */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 ml-1">
          Next Steps
        </h2>

        {tasks
          .filter((t) => t.status !== "done")
          .map((task) => (
            <div
              key={task._id}
              className="bg-white rounded-xl p-4 shadow-sm border border-slate-100"
            >
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
                    <h3 className="font-semibold text-slate-800 text-[15px]">{task.title}</h3>
                    {task.isAI && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-slate-900 uppercase tracking-wide">
                        AI
                      </span>
                    )}
                  </div>
                  
                  {/* AI Progress Bar */}
                  {task.isAI && task.aiProgress !== undefined && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-500">AI Progress</span>
                        <span className="font-medium text-primary">{task.aiProgress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all"
                          style={{ width: `${task.aiProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* AI Status Badge */}
                  {task.isAI && task.aiStatus && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide
                        ${task.aiStatus === 'assigned' ? 'bg-blue-100 text-blue-700' : 
                          task.aiStatus === 'working' ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-green-100 text-green-700'}`}>
                        {task.aiStatus === 'assigned' && '🤖 Assigned'}
                        {task.aiStatus === 'working' && '⚡ AI Working'}
                        {task.aiStatus === 'completed' && '✅ Done'}
                      </span>
                    </div>
                  )}
                  
                  {/* AI Notes */}
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
                    {task.status === "in_progress" && (
                      <div className="flex items-center text-primary gap-1">
                        <span className="material-icons text-sm">auto_awesome</span>
                        <span className="text-xs font-medium">In Progress</span>
                      </div>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-slate-400 mt-0.5">{task.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}
