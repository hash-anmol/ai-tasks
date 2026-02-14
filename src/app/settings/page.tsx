"use client";

import { useState } from "react";
import { useGamification } from "@/hooks/useGamification";
import BottomNav from "@/components/BottomNav";

export default function SettingsPage() {
  const { stats } = useGamification();
  const [notifications, setNotifications] = useState(true);

  return (
    <div className="min-h-screen bg-background-light p-5">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Profile Section */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h3 className="font-bold">Anmol</h3>
            <p className="text-sm text-slate-500">Level {stats.level} • {stats.coins} coins</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <h3 className="font-bold mb-3">Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-primary">{stats.tasksCompleted}</p>
            <p className="text-xs text-slate-500">Tasks Done</p>
          </div>
          <div className="text-center p-3 bg-slate-50 rounded-lg">
            <p className="text-2xl font-bold text-primary">{stats.streak}</p>
            <p className="text-xs text-slate-500">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <h3 className="font-bold mb-3">Preferences</h3>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Notifications</span>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`w-12 h-6 rounded-full transition-colors ${
              notifications ? "bg-primary" : "bg-slate-300"
            }`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
              notifications ? "translate-x-6" : "translate-x-0.5"
            }`}></div>
          </button>
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h3 className="font-bold mb-3">About</h3>
        <div className="space-y-2 text-sm text-slate-500">
          <p>AI Tasks v1.0.0</p>
          <p>Built with Next.js + Convex</p>
          <p className="text-xs">© 2026 AI Tasks</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
