"use client";

import { useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import AddTaskButton from "@/components/AddTaskButton";

const shortcuts = [
  { key: "n", description: "New task", action: "Opens add task modal" },
  { key: "1-5", description: "Switch tabs", action: "Navigate between tabs" },
  { key: "k", description: "Search", action: "Focus search bar" },
  { key: "?", description: "Help", action: "Show keyboard shortcuts" },
];

export default function ShortcutsPage() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Keyboard shortcuts can be implemented here
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <h1 className="text-2xl font-bold mb-2">Keyboard Shortcuts</h1>
      <p className="text-sm text-slate-500 mb-6">Speed up your workflow</p>

      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <h2 className="font-bold mb-4">Available Shortcuts</h2>
        <div className="space-y-3">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between">
              <div>
                <kbd className="px-2 py-1 bg-slate-100 rounded text-sm font-mono">{s.key}</kbd>
                <span className="ml-3 text-sm text-slate-600">{s.description}</span>
              </div>
              <span className="text-xs text-slate-400">{s.action}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h3 className="font-bold text-blue-800 mb-2">💡 Tip</h3>
        <p className="text-sm text-blue-600">
          More shortcuts coming soon! Enable dark mode in Settings for better night usage.
        </p>
      </div>

      <AddTaskButton />
      <BottomNav />
    </div>
  );
}
