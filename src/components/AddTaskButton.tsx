"use client";

import { useState, useEffect } from "react";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  dueDate?: number;
  tags: string[];
  isAI: boolean;
  agent?: string;
  dependsOn?: string[];
  aiStatus?: string;
  aiProgress?: number;
  createdAt: number;
  updatedAt: number;
}

const AGENTS = [
  { id: "main", name: "Main Agent", emoji: "🤖", color: "bg-primary" },
];

export default function AddTaskButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [isAI, setIsAI] = useState(false);
  const [agent, setAgent] = useState<string | undefined>(undefined);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);

  // Fetch existing tasks for dependencies
  useEffect(() => {
    if (isOpen) {
      fetch('/api/tasks')
        .then(res => res.json())
        .then(data => {
          setExistingTasks((data.tasks || []).filter((t: Task) => t.status !== "done"));
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Create task via REST API
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status: "pending",
          priority,
          dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
          tags: [],
          isAI,
          agent: isAI ? agent : undefined,
          dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
        }),
      });

      const data = await res.json();

      // If AI task, queue for OpenClaw to pick up
      if (isAI && data._id) {
        try {
          await fetch("/api/openclaw/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim(),
              agent,
              taskId: data._id,
            }),
          });
          console.log("✅ Task queued for AI agent:", agent);
        } catch (err) {
          console.log("OpenClaw queue error:", err);
        }
      }

      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setIsAI(false);
      setAgent(undefined);
      setDependsOn([]);
      setIsOpen(false);
      
      // Refresh the page to show new task
      window.location.reload();
    } catch (err) {
      console.error("Error creating task:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDependency = (taskId: string) => {
    setDependsOn(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  return (
    <>
      <button
        className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-primary text-slate-900 w-14 h-14 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center z-50 active:scale-95 transition-transform"
        onClick={() => setIsOpen(true)}
      >
        <span className="material-icons text-3xl font-bold">add</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center">
          <div 
            className="bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-3xl sm:rounded-3xl p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">New Task</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
              >
                <span className="material-icons text-sm">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="text"
                  placeholder="Task title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary focus:outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAI(!isAI)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    isAI 
                      ? "border-primary bg-primary/10 text-primary" 
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <span className="material-icons text-sm">smart_toy</span>
                  <span className="text-sm font-medium">AI Task</span>
                </button>

                {isAI && (
                  <select
                    value={agent || ""}
                    onChange={(e) => setAgent(e.target.value || undefined)}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none text-sm"
                  >
                    <option value="">Select Agent</option>
                    {AGENTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {existingTasks.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-2">Depends on (optional)</label>
                  <div className="flex flex-wrap gap-2">
                    {existingTasks.map((task: Task) => (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => toggleDependency(task._id)}
                        className={`px-3 py-1 rounded-full text-xs transition-colors ${
                          dependsOn.includes(task._id)
                            ? "bg-primary text-slate-900"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {task.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!title.trim() || isSubmitting}
                className="w-full py-3 bg-primary text-slate-900 font-semibold rounded-xl active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Creating..." : "Create Task"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
