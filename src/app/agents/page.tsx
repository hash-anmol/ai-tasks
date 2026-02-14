"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  color: string;
  status: "idle" | "active" | "blocked";
  currentTask?: string;
  tasksCompleted: number;
}

const AGENTS: Agent[] = [
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500", status: "idle", tasksCompleted: 12 },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500", status: "active", currentTask: "Generate Project Roadmap", tasksCompleted: 8 },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500", status: "idle", tasksCompleted: 5 },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500", status: "active", currentTask: "Task Breakdown", tasksCompleted: 15 },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(AGENTS);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ai-tasks");
    if (stored) {
      setTasks(JSON.parse(stored));
    }
  }, []);

  const getAgentTasks = (agentId: string) => {
    return tasks.filter(t => t.agent === agentId && t.status !== "done");
  };

  const getStatusColor = (status: Agent["status"]) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "blocked": return "bg-red-500";
      default: return "bg-slate-400";
    }
  };

  const getStatusLabel = (status: Agent["status"]) => {
    switch (status) {
      case "active": return "Working";
      case "blocked": return "Blocked";
      default: return "Idle";
    }
  };

  return (
    <div className="min-h-screen bg-background-light p-5 pb-24">
      <h1 className="text-2xl font-bold mb-2">Agents</h1>
      <p className="text-sm text-slate-500 mb-6">AI agents working on your tasks</p>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
            className={`bg-white rounded-xl p-4 shadow-sm cursor-pointer transition-all ${
              selectedAgent === agent.id ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl ${agent.color} flex items-center justify-center text-2xl`}>
                {agent.emoji}
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(agent.status)}`}></div>
                <span className="text-xs text-slate-500">{getStatusLabel(agent.status)}</span>
              </div>
            </div>
            
            <h3 className="font-bold text-slate-800">{agent.name}</h3>
            
            {agent.currentTask && agent.status === "active" && (
              <p className="text-xs text-slate-500 mt-1 truncate">Working on: {agent.currentTask}</p>
            )}
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-slate-400">{agent.tasksCompleted} tasks done</span>
              {getAgentTasks(agent.id).length > 0 && (
                <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  {getAgentTasks(agent.id).length} active
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Agent Tasks */}
      {selectedAgent && (
        <div>
          <h2 className="font-bold text-lg mb-3">
            {AGENTS.find(a => a.id === selectedAgent)?.emoji} {AGENTS.find(a => a.id === selectedAgent)?.name}'s Tasks
          </h2>
          <div className="space-y-2">
            {getAgentTasks(selectedAgent).length === 0 ? (
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-slate-400 text-sm">No active tasks</p>
              </div>
            ) : (
              getAgentTasks(selectedAgent).map((task) => (
                <div key={task._id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-800">{task.title}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      task.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {task.status === "in_progress" ? "In Progress" : "Assigned"}
                    </span>
                  </div>
                  {task.aiProgress !== undefined && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full" 
                          style={{ width: `${task.aiProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{task.aiProgress}% complete</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
