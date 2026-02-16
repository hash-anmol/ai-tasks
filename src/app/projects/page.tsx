"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import AddTaskButton from "@/components/AddTaskButton";

interface Task {
  _id: string;
  title: string;
  status: string;
  isAI: boolean;
}

export default function ProjectsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("ai-tasks");
    if (stored) {
      setTasks(JSON.parse(stored));
    }
  }, []);

  // Group tasks by tag/project
  const projects = [
    { id: "personal", name: "Personal", color: "bg-blue-500", tasks: tasks.filter((t) => !t.isAI && !t.status?.includes("work")) },
    { id: "work", name: "Work", color: "bg-purple-500", tasks: tasks.filter((t) => t.isAI) },
    { id: "ai", name: "AI Projects", color: "bg-primary", tasks: tasks.filter((t) => t.isAI) },
  ];

  return (
    <div className="min-h-screen bg-background-light p-5">
      <h1 className="text-2xl font-bold mb-2">Projects</h1>
      <p className="text-sm text-slate-500 mb-6">Organize your tasks by project</p>

      <div className="space-y-4">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${project.color}`}></div>
              <h3 className="font-bold">{project.name}</h3>
              <span className="text-xs text-slate-400 ml-auto">
                {project.tasks.length} tasks
              </span>
            </div>
            {project.tasks.length > 0 ? (
              <div className="space-y-2">
                {project.tasks.slice(0, 3).map((task) => (
                  <div key={task._id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className={`w-2 h-2 rounded-full ${
                      task.status === "done" ? "bg-green-500" : "bg-slate-300"
                    }`}></span>
                    {task.title}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">No tasks yet</p>
            )}
          </div>
        ))}
      </div>
      <AddTaskButton />
      <BottomNav />
    </div>
  );
}
