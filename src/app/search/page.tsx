"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppFooter from "@/components/AppFooter";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  isAI: boolean;
  agent?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const router = useRouter();
  const tasksQuery = useQuery(api.tasks.getTasks);
  const tasks = (tasksQuery || []) as Task[];

  useEffect(() => {
    if (query.trim()) {
      const q = query.toLowerCase();
      const filtered = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.agent?.toLowerCase().includes(q)
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  }, [query, tasks]);

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high": return "bg-red-100 text-red-700";
      case "medium": return "bg-yellow-100 text-yellow-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <h1 className="text-2xl font-bold mb-4">Search</h1>

      <div className="relative mb-6">
        <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
        <input
          type="text"
          placeholder="Search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
          autoFocus
        />
      </div>

      {query && (
        <p className="text-sm text-slate-500 mb-4">{results.length} results</p>
      )}

      <div className="space-y-2">
        {results.length === 0 && query && (
          <div className="text-center py-8">
            <span className="material-icons text-4xl text-slate-300 mb-2">search_off</span>
            <p className="text-slate-400">No tasks found</p>
          </div>
        )}

        {results.map((task) => (
          <div
            key={task._id}
            onClick={() => router.push("/")}
            className="bg-white rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-medium text-slate-800">{task.title}</h3>
              <div className="flex gap-1">
                {task.priority && (
                  <span className={`text-[10px] px-2 py-0.5 rounded ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                )}
                {task.isAI && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-primary/20 text-primary">AI</span>
                )}
              </div>
            </div>
            {task.description && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>
            )}
            {task.agent && (
              <span className="text-xs text-slate-400 mt-2 inline-block">{task.agent}</span>
            )}
          </div>
        ))}
      </div>

      <AppFooter />
    </div>
  );
}
