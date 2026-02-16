"use client";

import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import BottomNav from "@/components/BottomNav";
import AddTaskButton from "@/components/AddTaskButton";

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
    <div className="min-h-screen bg-[var(--background)] p-5 pb-24">
      <div className="flex items-center justify-between mb-6 mt-10">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-blue-500 font-medium">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={markAllAsRead}
            className="text-xs text-[var(--text-secondary)] font-medium hover:text-[var(--text-primary)] transition-colors"
          >
            Mark all read
          </button>
          <button
            onClick={clearAll}
            className="text-xs text-[var(--text-secondary)] hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filter by agent */}
      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-1">
        <button
          onClick={() => setFilter(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
            !filter 
              ? "bg-[var(--text-primary)] text-[var(--background)] border-[var(--text-primary)]" 
              : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]"
          }`}
        >
          All
        </button>
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setFilter(agent.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all border ${
              filter === agent.id 
                ? "bg-[var(--text-primary)] text-[var(--background)] border-[var(--text-primary)]" 
                : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]"
            }`}
          >
            {agent.emoji} {agent.name}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-20 opacity-30">
            <span className="material-icons text-5xl text-[var(--text-secondary)] mb-3">notifications_none</span>
            <p className="text-[var(--text-secondary)] font-light">No notifications</p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => markAsRead(notification.id)}
              className={`bg-[var(--surface)] rounded-2xl p-4 shadow-sm border border-[var(--border)] cursor-pointer transition-all ${
                notification.read ? "opacity-50" : "border-l-4 border-l-blue-500"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-0.5">
                  {getAgentInfo(notification.agent)?.emoji}
                </div>
                <div className="flex-grow">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      @{notification.agent}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] opacity-60">
                      {new Date(notification.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[13px] text-[var(--text-primary)] font-light leading-relaxed">{notification.message}</p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shadow-sm"></div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <AddTaskButton />
      <BottomNav />
    </div>
  );
}
