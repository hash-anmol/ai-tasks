"use client";

import { useEffect, useState } from "react";
import { useGamification } from "@/hooks/useGamification";
import BottomNav from "@/components/BottomNav";
import AddTaskButton from "@/components/AddTaskButton";
import Link from "next/link";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { stats } = useGamification();
  const [notifications, setNotifications] = useState(true);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] p-5 pb-24">
      <h1 className="text-2xl font-bold mb-6 text-[var(--text-primary)]">Settings</h1>

      {/* Profile Section */}
      <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] shadow-sm mb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[var(--text-primary)]/10 flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Anmol</h3>
            <p className="text-sm text-[var(--text-secondary)]">Level {stats.level} • {stats.coins} coins</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] shadow-sm mb-4">
        <h3 className="font-bold mb-3 text-[var(--text-primary)]">Statistics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-[var(--background)] border border-[var(--border)] rounded-lg">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.tasksCompleted}</p>
            <p className="text-xs text-[var(--text-secondary)]">Tasks Done</p>
          </div>
          <div className="text-center p-3 bg-[var(--background)] border border-[var(--border)] rounded-lg">
            <p className="text-2xl font-bold text-[var(--text-primary)]">{stats.streak}</p>
            <p className="text-xs text-[var(--text-secondary)]">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] shadow-sm mb-4">
        <h3 className="font-bold mb-3 text-[var(--text-primary)]">Preferences</h3>
        
        <div className="flex items-center justify-between py-2">
          <span className="text-sm text-[var(--text-primary)]">Dark Mode</span>
          <button
            className="text-xs text-[var(--text-primary)] font-medium px-2 py-1 bg-[var(--background)] border border-[var(--border)] rounded"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {mounted ? (theme === 'dark' ? 'Turn Off' : 'Turn On') : '...'}
          </button>
        </div>
        
        <div className="flex items-center justify-between py-2 border-t border-[var(--border)]">
          <span className="text-sm text-[var(--text-primary)]">Notifications</span>
          <button
            onClick={() => setNotifications(!notifications)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              notifications ? "bg-blue-500" : "bg-[var(--border)]"
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              notifications ? "translate-x-[22px]" : "translate-x-0.5"
            }`}></div>
          </button>
        </div>
      </div>

      {/* Webhooks */}
      <Link href="/webhooks" className="block bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Webhooks</h3>
            <p className="text-sm text-[var(--text-secondary)]">Manage integrations</p>
          </div>
          <span className="material-icons text-[var(--text-secondary)]">chevron_right</span>
        </div>
      </Link>

      {/* Keyboard Shortcuts */}
      <Link href="/shortcuts" className="block bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Keyboard Shortcuts</h3>
            <p className="text-sm text-[var(--text-secondary)]">Speed up workflow</p>
          </div>
          <span className="material-icons text-[var(--text-secondary)]">chevron_right</span>
        </div>
      </Link>

      {/* Import/Export */}
      <Link href="/import-export" className="block bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-[var(--text-primary)]">Import / Export</h3>
            <p className="text-sm text-[var(--text-secondary)]">Backup your tasks</p>
          </div>
          <span className="material-icons text-[var(--text-secondary)]">chevron_right</span>
        </div>
      </Link>

      {/* About */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
        <h3 className="font-bold mb-3 text-[var(--text-primary)]">About</h3>
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>AI Tasks v1.0.0</p>
          <p>Built with Next.js + Convex</p>
          <p className="text-xs opacity-60">© 2026 AI Tasks</p>
        </div>
      </div>
      <AddTaskButton />
      <BottomNav />
    </div>
  );
}
