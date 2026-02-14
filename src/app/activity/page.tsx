"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

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
      case "created": return "bg-blue-100 text-blue-700";
      case "updated": return "bg-yellow-100 text-yellow-700";
      case "completed": return "bg-green-100 text-green-700";
      case "commented": return "bg-purple-100 text-purple-700";
      default: return "bg-slate-100 text-slate-700";
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
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <h1 className="text-2xl font-bold mb-2">Activity</h1>
      <p className="text-sm text-slate-500 mb-6">Recent updates across all tasks</p>

      {activities.length === 0 ? (
        <div className="text-center py-12">
          <span className="material-icons text-4xl text-slate-300 mb-2">history</span>
          <p className="text-slate-400">No activity yet</p>
          <p className="text-xs text-slate-400 mt-1">Create or complete tasks to see activity</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${getActivityColor(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-slate-800">
                      {activity.type === "completed" ? "Completed" : 
                       activity.type === "created" ? "Created" :
                       activity.type === "updated" ? "Updated" : "Commented on"}
                    </span>
                    <span className="text-xs text-slate-400">{formatTime(activity.timestamp)}</span>
                  </div>
                  <p className="text-sm text-slate-700">{activity.taskTitle}</p>
                  {activity.details && (
                    <p className="text-xs text-slate-500 mt-1">{activity.details}</p>
                  )}
                  {activity.agent && (
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 mt-1 inline-block">
                      {activity.agent}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
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
