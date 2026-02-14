"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import BottomNav from "@/components/BottomNav";

const AGENTS = [
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500" },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500" },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500" },
];

const getAgentInfo = (agentId: string) => AGENTS.find(a => a.id === agentId);

export default function NotificationsPage() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [filter, setFilter] = useState<string | null>(null);

  const filteredNotifications = filter 
    ? notifications.filter(n => n.agent === filter)
    : notifications;

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-primary font-medium">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={markAllAsRead}
            className="text-xs text-primary font-medium"
          >
            Mark all read
          </button>
          <button
            onClick={clearAll}
            className="text-xs text-slate-400"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filter by agent */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
            !filter ? "bg-primary text-slate-900" : "bg-white text-slate-600"
          }`}
        >
          All
        </button>
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setFilter(agent.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1 ${
              filter === agent.id ? "bg-primary text-slate-900" : "bg-white text-slate-600"
            }`}
          >
            {agent.emoji} {agent.name}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-icons text-4xl text-slate-300 mb-2">notifications_none</span>
            <p className="text-slate-400">No notifications</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
                notification.read ? "opacity-60" : "border-l-4 border-l-primary"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xl">
                  {getAgentInfo(notification.agent)?.emoji}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">
                      @{notification.agent}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(notification.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{notification.message}</p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
