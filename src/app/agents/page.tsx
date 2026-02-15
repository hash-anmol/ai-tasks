"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

interface AgentStats {
  id: string;
  name: string;
  emoji: string;
  color: string;
  status: "idle" | "active" | "blocked";
  currentTask?: string;
  tasksCompleted: number;
}

const AGENTS_CONFIG = [
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500" },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500" },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500" },
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // Get agent stats - for now static, will connect to API later
  const getAgentStats = (): AgentStats[] => {
    return AGENTS_CONFIG.map((agent) => ({
      ...agent,
      status: "idle" as const,
      tasksCompleted: 0,
    }));
  };

  const agents = getAgentStats();

  const getStatusColor = (status: AgentStats["status"]) => {
    switch (status) {
      case "active": return "bg-green-500";
      case "blocked": return "bg-red-500";
      default: return "bg-slate-400";
    }
  };

  const getStatusLabel = (status: AgentStats["status"]) => {
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
            </div>
          </div>
        ))}
      </div>

      {/* Selected Agent Tasks */}
      {selectedAgent && (
        <div>
          <h2 className="font-bold text-lg mb-3">
            {AGENTS_CONFIG.find(a => a.id === selectedAgent)?.emoji} {AGENTS_CONFIG.find(a => a.id === selectedAgent)?.name}'s Tasks
          </h2>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <p className="text-slate-400 text-sm">No tasks assigned</p>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
