"use client";

import { useState, useEffect } from "react";

interface Notification {
  id: string;
  type: "mention";
  fromTaskId: string;
  fromTaskTitle: string;
  agent: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_KEY = "ai-tasks-notifications";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications on mount
  useEffect(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      setNotifications(parsed);
      setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
    }
  }, []);

  // Save notifications whenever they change
  useEffect(() => {
    if (notifications.length > 0) {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
      setUnreadCount(notifications.filter((n) => !n.read).length);
    }
  }, [notifications]);

  // Add a new notification
  const addNotification = (notification: Omit<Notification, "id" | "read" | "createdAt">) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  // Parse text for mentions and create notifications
  const parseMentions = (text: string, taskId: string, taskTitle: string) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = text.match(mentionRegex);
    
    if (mentions) {
      const agents = ["researcher", "writer", "editor", "coordinator"];
      mentions.forEach((mention) => {
        const agent = mention.replace("@", "");
        if (agents.includes(agent)) {
          addNotification({
            type: "mention",
            fromTaskId: taskId,
            fromTaskTitle: taskTitle,
            agent,
            message: `You were mentioned in "${taskTitle}": ${text}`,
          });
        }
      });
    }
  };

  // Mark notification as read
  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem(NOTIFICATIONS_KEY);
  };

  // Get notifications for a specific agent
  const getAgentNotifications = (agent: string) => {
    return notifications.filter((n) => n.agent === agent);
  };

  return {
    notifications,
    unreadCount,
    addNotification,
    parseMentions,
    markAsRead,
    markAllAsRead,
    clearAll,
    getAgentNotifications,
  };
}
