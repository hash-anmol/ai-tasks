"use client";

import { useState, useEffect } from "react";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  dueDate?: string;
  tags: string[];
  isAI: boolean;
  agent?: "researcher" | "writer" | "editor" | "coordinator";
  dependsOn?: string[];
  createdAt: string;
  updatedAt: string;
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
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [isAI, setIsAI] = useState(false);
  const [agent, setAgent] = useState<Task["agent"]>(undefined);
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [existingTasks, setExistingTasks] = useState<Task[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("ai-tasks");
    if (stored) {
      const tasks = JSON.parse(stored);
      setExistingTasks(tasks.filter((t: Task) => t.status !== "done"));
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    const newTask: Task = {
      _id: Date.now().toString(),
      title: title.trim(),
      description: description.trim() || undefined,
      status: "pending",
      priority,
      dueDate: dueDate || undefined,
      tags: [],
      isAI,
      agent: isAI ? agent : undefined,
      dependsOn: dependsOn.length > 0 ? dependsOn : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const stored = localStorage.getItem("ai-tasks");
    const tasks: Task[] = stored ? JSON.parse(stored) : [];
    tasks.push(newTask);
    localStorage.setItem("ai-tasks", JSON.stringify(tasks));

    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setIsAI(false);
    setAgent(undefined);
    setDependsOn([]);
    setIsOpen(false);

    window.location.reload();
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
        className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-primary text-slate-900 w-16 h-16 rounded-full shadow-lg shadow-primary/30 flex items-center justify-center z-50 active:scale-95 transition-transform"
        onClick={() => setIsOpen(true)}
      >
        <span className="material-icons text-3xl font-bold">add</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Add New Task</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  placeholder="Add more details..."
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Due Date
                  </label>
                  <input
                    type="time"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-primary focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="aiTask"
                  checked={isAI}
                  onChange={(e) => setIsAI(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <label
                  htmlFor="aiTask"
                  className="text-sm text-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-icons text-primary text-sm">auto_awesome</span>
                  Assign to AI Agent
                </label>
              </div>

              {isAI && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select Agent
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {AGENTS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setAgent(a.id as Task["agent"])}
                        className={`p-3 rounded-lg border-2 flex items-center gap-2 transition-colors ${
                          agent === a.id
                            ? "border-primary bg-primary/10"
                            : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span>{a.emoji}</span>
                        <span className="text-sm font-medium">{a.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {existingTasks.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Depends on (optional)
                  </label>
                  <p className="text-xs text-slate-500 mb-2">This task will be blocked until selected tasks are done</p>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {existingTasks.map((task) => (
                      <label
                        key={task._id}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={dependsOn.includes(task._id)}
                          onChange={() => toggleDependency(task._id)}
                          className="w-4 h-4 rounded border-slate-300 text-primary"
                        />
                        <span className="text-sm truncate">{task.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-primary text-slate-900 font-semibold py-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                Add Task
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
