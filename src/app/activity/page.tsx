"use client";

import { useState, useEffect } from "react";
import AppFooter from "@/components/AppFooter";

interface Activity {
  id: string;
  type: "created" | "updated" | "completed" | "commented";
  taskId: string;
  taskTitle: string;
  agent?: string;
  details?: string;
  timestamp: string;
}

const ACTIVITY_KEY = "ai-tasks-activity";

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVITY_KEY);
    if (stored) {
      setActivities(JSON.parse(stored));
    }
  }, []);

  const getActivityIcon = (type: Activity["type"]) => {
    switch (type) {
      case "created": return "➕";
      case "updated": return "✏️";
      case "completed": return "✅";
      case "commented": return "💬";
      default: return "📝";
    }
  };

  const getActivityColor = (type: Activity["type"]) => {
    switch (type) {
      case "created": return "bg-blue-500/10 text-blue-500";
      case "updated": return "bg-yellow-500/10 text-yellow-500";
      case "completed": return "bg-green-500/10 text-green-500";
      case "commented": return "bg-purple-500/10 text-purple-500";
      default: return "bg-[var(--border)] text-[var(--text-primary)]";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[var(--background)] p-5 pb-24 text-[var(--text-primary)]">
      <h1 className="text-2xl font-bold mb-2">Activity</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">Recent updates across all tasks</p>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-icons text-4xl text-[var(--border)] mb-2 opacity-50">history</span>
          <p className="text-[var(--text-secondary)]">No activity yet</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-60">Create or complete tasks to see activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[var(--text-primary)]">
                      {activity.type === "completed" ? "Completed" : 
                       activity.type === "created" ? "Created" :
                       activity.type === "updated" ? "Updated" : "Commented on"}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] opacity-60">{formatTime(activity.timestamp)}</span>
                  </div>
                  <p className="text-sm text-[var(--text-primary)] opacity-90">{activity.taskTitle}</p>
                  {activity.details && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 opacity-80">{activity.details}</p>
                  )}
                  {activity.agent && (
                    <span className="text-xs bg-[var(--background)] px-2 py-0.5 rounded text-[var(--text-secondary)] mt-1 inline-block border border-[var(--border)]">
                      {activity.agent}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AppFooter />
    </div>
  );
}

// Helper function to log activity (import this in other components)
export function logActivity(
  type: Activity["type"],
  taskId: string,
  taskTitle: string,
  agent?: string,
  details?: string
) {
  const activity: Activity = {
    id: Date.now().toString(),
    type,
    taskId,
    taskTitle,
    agent,
    details,
    timestamp: new Date().toISOString(),
  };

  const stored = localStorage.getItem(ACTIVITY_KEY);
  const activities = stored ? JSON.parse(stored) : [];
  
  // Add new activity at the beginning, keep only last 50
  const updated = [activity, ...activities].slice(0, 50);
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(updated));
}
