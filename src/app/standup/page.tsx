"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

interface Task {
  _id: string;
  title: string;
  status: string;
  agent?: string;
  dependsOn?: string[];
  updatedAt: string;
}

export default function StandupPage() {
  const [completed, setCompleted] = useState<Task[]>([]);
  const [inProgress, setInProgress] = useState<Task[]>([]);
  const [blocked, setBlocked] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ai-tasks");
    if (stored) {
      const tasks: Task[] = JSON.parse(stored);
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Completed yesterday
      const completedTasks = tasks.filter(t => {
        const updated = new Date(t.updatedAt);
        return t.status === "done" && updated >= yesterday;
      });
      setCompleted(completedTasks);

      // In progress
      const inProgressTasks = tasks.filter(t => 
        t.status === "in_progress" || t.status === "assigned"
      );
      setInProgress(inProgressTasks);

      // Blocked
      const blockedTasks = tasks.filter(t => {
        if (!t.dependsOn || t.dependsOn.length === 0) return false;
        return !t.dependsOn.every(depId => {
          const depTask = tasks.find(task => task._id === depId);
          return depTask?.status === "done";
        });
      });
      setBlocked(blockedTasks);
    }
    setLoading(false);
  }, []);

  const getFormattedMessage = () => {
    const now = new Date();
    let message = `📊 *Daily Standup* — ${now.toLocaleDateString("en-IN", { 
      weekday: "long", 
      month: "short", 
      day: "numeric" 
    })}\n\n`;

    message += `✅ *Completed* (${completed.length})\n`;
    completed.forEach(t => {
      message += `• ${t.title}\n`;
    });
    if (completed.length === 0) message += `_Nothing completed_\n`;
    message += "\n";

    message += `🔄 *In Progress* (${inProgress.length})\n`;
    inProgress.forEach(t => {
      const agent = t.agent ? ` [${t.agent}]` : "";
      message += `• ${t.title}${agent}\n`;
    });
    if (inProgress.length === 0) message += `_Nothing in progress_\n`;
    message += "\n";

    message += `🚧 *Blockers* (${blocked.length})\n`;
    blocked.forEach(t => {
      message += `• ${t.title} — blocked\n`;
    });
    if (blocked.length === 0) message += `_No blockers! 🎉_\n`;

    return message;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getFormattedMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Daily Standup</h1>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString("en-IN", { 
              weekday: "long", 
              month: "long", 
              day: "numeric" 
            })}
          </p>
        </div>
        <button
          onClick={copyToClipboard}
          className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            copied 
              ? "bg-green-500 text-white" 
              : "bg-primary text-slate-900"
          }`}
        >
          {copied ? "✓ Copied!" : "Copy"}
        </button>
      </div>

      {/* Completed */}
      <div className="mb-4">
        <h2 className="text-sm font-bold text-green-600 mb-2 flex items-center gap-2">
          <span>✅</span> Completed ({completed.length})
        </h2>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          {completed.length > 0 ? (
            <ul className="space-y-2">
              {completed.map(task => (
                <li key={task._id} className="text-sm text-slate-700 flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  {task.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">Nothing completed yesterday</p>
          )}
        </div>
      </div>

      {/* In Progress */}
      <div className="mb-4">
        <h2 className="text-sm font-bold text-yellow-600 mb-2 flex items-center gap-2">
          <span>🔄</span> In Progress ({inProgress.length})
        </h2>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          {inProgress.length > 0 ? (
            <ul className="space-y-2">
              {inProgress.map(task => (
                <li key={task._id} className="text-sm text-slate-700 flex items-center gap-2">
                  <span className="text-yellow-500">▸</span>
                  {task.title}
                  {task.agent && (
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500">
                      {task.agent}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">Nothing in progress</p>
          )}
        </div>
      </div>

      {/* Blockers */}
      <div className="mb-4">
        <h2 className="text-sm font-bold text-red-600 mb-2 flex items-center gap-2">
          <span>🚧</span> Blockers ({blocked.length})
        </h2>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          {blocked.length > 0 ? (
            <ul className="space-y-2">
              {blocked.map(task => (
                <li key={task._id} className="text-sm text-slate-700 flex items-center gap-2">
                  <span className="text-red-500">⚠</span>
                  {task.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-500 italic">🎉 No blockers!</p>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
