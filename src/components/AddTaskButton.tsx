"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

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
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500" },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500" },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500" },
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
  const existingTasks = (useQuery(api.tasks.getTasks) || []) as Task[];
  const createTask = useMutation(api.tasks.createTask);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const taskId = await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        status: isAI ? "assigned" : "inbox",
        priority,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
        tags: [],
        isAI,
        agent: isAI ? agent : undefined,
        dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      } as any);

      // Close modal and reset form immediately
      const savedTitle = title.trim();
      const savedDescription = description.trim();
      const savedAgent = agent;
      const savedIsAI = isAI;

      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setIsAI(false);
      setAgent(undefined);
      setDependsOn([]);
      setIsOpen(false);
      setIsSubmitting(false);

      // Fire-and-forget: send to OpenClaw in the background
      // The execute endpoint already processes asynchronously and updates
      // task status via Convex mutations when complete
      if (savedIsAI && taskId) {
        fetch("/api/openclaw/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: savedTitle,
            description: savedDescription,
            agent: savedAgent,
            taskId,
          }),
        }).catch((err) => {
          console.log("OpenClaw queue error (background):", err);
        });
      }

      return;
    } catch (err) {
      console.error("Error creating task:", err);
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
      {/* Google-plus-style FAB - centered in bottom nav cutout */}
      <div className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
        <div className="absolute left-1/2 -translate-x-1/2 -top-7 z-20 pointer-events-auto">
          <button
            className="w-16 h-16 bg-[var(--surface)] rounded-full shadow-fab flex items-center justify-center transform transition-transform active:scale-95 border border-[var(--border)] dark:shadow-blue-500/10 dark:shadow-lg"
            onClick={() => setIsOpen(true)}
          >
            {/* Google-colored plus icon */}
            <div className="relative w-8 h-8">
              <div className="g-v-top"></div>
              <div className="g-v-bottom"></div>
              <div className="g-h-left"></div>
              <div className="g-h-right"></div>
            </div>
          </button>
        </div>
        {/* This invisible div establishes the height reference for the FAB positioning */}
        <div className="h-20"></div>
      </div>

      {/* Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-end sm:items-center justify-center"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
          onTouchStart={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div 
            className="bg-[var(--surface)] w-full sm:max-w-lg max-h-[85vh] rounded-t-3xl sm:rounded-2xl p-6 overflow-y-auto border-x border-t sm:border border-[var(--border)] shadow-2xl"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-light text-[var(--text-primary)]">New Task</h2>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-[var(--background)] flex items-center justify-center hover:bg-[var(--border)] transition-colors border border-[var(--border)]"
              >
                <span className="material-icons text-base text-[var(--text-secondary)]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-0 py-3 border-0 border-b border-[var(--border)] focus:border-blue-500 focus:outline-none focus:ring-0 text-lg font-light placeholder:text-[var(--text-secondary)]/40 bg-transparent text-[var(--text-primary)] transition-colors"
                  autoFocus
                />
              </div>

              <div>
                <textarea
                  placeholder="Add details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-0 py-2 border-0 border-b border-[var(--border)] focus:border-blue-500 focus:outline-none focus:ring-0 resize-none text-[15px] font-light text-[var(--text-primary)] opacity-80 placeholder:text-[var(--text-secondary)]/40 bg-transparent transition-colors"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Due Date</label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    onFocus={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 focus:border-blue-500 focus:outline-none text-sm font-light text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--background)]/50 focus:border-blue-500 focus:outline-none text-sm font-light text-[var(--text-primary)]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setIsAI(!isAI)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full border transition-all text-sm ${
                    isAI 
                      ? "border-blue-500 bg-blue-500/10 text-blue-500 font-medium" 
                      : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-primary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <span className="material-icons text-base">smart_toy</span>
                  <span>AI Task</span>
                </button>

                {isAI && (
                  <select
                    value={agent || ""}
                    onChange={(e) => setAgent(e.target.value || undefined)}
                    className="flex-1 px-4 py-2.5 rounded-full border border-blue-500/30 bg-blue-500/5 focus:border-blue-500 focus:outline-none text-sm font-medium text-blue-500"
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
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Depends on</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    {existingTasks
                      .filter((task: Task) => task.status !== "done")
                      .map((task: Task) => (
                      <button
                        key={task._id}
                        type="button"
                        onClick={() => toggleDependency(task._id)}
                        className={`px-4 py-1.5 rounded-full text-xs transition-all border ${
                          dependsOn.includes(task._id)
                            ? "bg-blue-500 border-blue-500 text-white"
                            : "bg-[var(--background)]/50 text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--text-secondary)]"
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
                className="w-full py-4 bg-[var(--text-primary)] text-[var(--background)] font-semibold rounded-2xl active:scale-[0.98] transition-all disabled:opacity-20 disabled:cursor-not-allowed text-[15px] shadow-lg shadow-black/5 mt-2"
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
