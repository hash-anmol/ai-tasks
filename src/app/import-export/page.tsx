"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";

export default function ImportExportPage() {
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const exportTasks = (format: 'json' | 'csv') => {
    const tasks = localStorage.getItem("ai-tasks");
    if (!tasks) {
      setMessage({ type: 'error', text: 'No tasks found' });
      return;
    }

    const parsed = JSON.parse(tasks);
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-tasks-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      setMessage({ type: 'success', text: 'Tasks exported as JSON!' });
    } else {
      // CSV export
      const headers = ['Title', 'Description', 'Status', 'Priority', 'Agent', 'AI', 'Created'];
      const rows = parsed.map((t: any) => [
        t.title,
        t.description || '',
        t.status,
        t.priority || '',
        t.agent || '',
        t.isAI ? 'Yes' : 'No',
        t.createdAt
      ]);
      
      const csv = [headers, ...rows].map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-tasks-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      setMessage({ type: 'success', text: 'Tasks exported as CSV!' });
    }
    
    setTimeout(() => setMessage(null), 3000);
  };

  const importTasks = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) throw new Error('Invalid format');
        
        const existing = localStorage.getItem("ai-tasks");
        const existingTasks = existing ? JSON.parse(existing) : [];
        
        // Merge, avoiding duplicates by ID
        const merged = [...existingTasks];
        imported.forEach((task: any) => {
          if (!merged.find(t => t._id === task._id)) {
            merged.push(task);
          }
        });
        
        localStorage.setItem("ai-tasks", JSON.stringify(merged));
        setMessage({ type: 'success', text: `Imported ${imported.length} tasks!` });
        setTimeout(() => setMessage(null), 3000);
      } catch {
        setMessage({ type: 'error', text: 'Invalid JSON file' });
        setTimeout(() => setMessage(null), 3000);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <h1 className="text-2xl font-bold mb-2">Import / Export</h1>
      <p className="text-sm text-slate-500 mb-6">Backup and restore your tasks</p>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Export */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <h2 className="font-bold mb-3">Export Tasks</h2>
        <div className="flex gap-2">
          <button
            onClick={() => exportTasks('json')}
            className="flex-1 bg-primary text-slate-900 py-2 px-4 rounded-lg font-medium text-sm"
          >
            📄 Export JSON
          </button>
          <button
            onClick={() => exportTasks('csv')}
            className="flex-1 bg-slate-100 text-slate-700 py-2 px-4 rounded-lg font-medium text-sm"
          >
            📊 Export CSV
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="bg-white rounded-xl p-4 shadow-sm mb-4">
        <h2 className="font-bold mb-3">Import Tasks</h2>
        <label className="block">
          <input
            type="file"
            accept=".json"
            onChange={importTasks}
            className="hidden"
          />
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors">
            <span className="material-icons text-3xl text-slate-300 mb-2">upload_file</span>
            <p className="text-sm text-slate-500">Click to upload JSON</p>
          </div>
        </label>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <h2 className="font-bold mb-3">Data Info</h2>
        <p className="text-sm text-slate-500">
          Tasks are stored locally in your browser. Export regularly to backup your data.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}
