"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface AgentStats {
  id: string;
  name: string;
  emoji: string;
  color: string;
  status: "idle" | "active" | "blocked";
  currentTask?: string;
  tasksCompleted: number;
}

interface AgentRun {
  _id: string;
  taskId?: string;
  agent: string;
  status: string;
  prompt: string;
  response?: string;
  progress: number;
  startedAt: number;
  completedAt?: number;
  blockers?: string[];
}

interface Task {
  _id: string;
  title: string;
  agent?: string;
  aiStatus?: string;
  status?: string;
}

const AGENTS_CONFIG = [
  { id: "researcher", name: "Researcher", emoji: "🔍", color: "bg-blue-500" },
  { id: "writer", name: "Writer", emoji: "✍️", color: "bg-purple-500" },
  { id: "editor", name: "Editor", emoji: "📝", color: "bg-orange-500" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯", color: "bg-green-500" },
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const tasks = (useQuery(api.tasks.getTasks) || []) as Task[];
  const runs = (useQuery(api.agentRuns.getAgentRuns) || []) as AgentRun[];

  const getAgentStats = (): AgentStats[] => {
    return AGENTS_CONFIG.map((agent) => ({
      ...agent,
      status: getAgentStatus(agent.id, runs),
      currentTask: getAgentCurrentTask(agent.id, tasks),
      tasksCompleted: runs.filter((run) => run.agent === agent.id && run.status === "completed").length,
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

  const getAgentRuns = (agentId: string) =>
    runs.filter((run: AgentRun) => run.agent === agentId);

  const findTaskTitle = (taskId?: string) =>
    tasks.find((task: Task) => task._id === taskId)?.title;

  function getAgentStatus(agentId: string, agentRuns: AgentRun[]): AgentStats["status"] {
    const blocked = agentRuns.some((run) => run.agent === agentId && run.status === "blocked");
    if (blocked) return "blocked";
    const active = agentRuns.some((run) => run.agent === agentId && run.status === "running");
    if (active) return "active";
    return "idle";
  }

  function getAgentCurrentTask(agentId: string, agentTasks: Task[]) {
    const activeTask = agentTasks.find(
      (task) => task.agent === agentId && (task.aiStatus === "running" || task.status === "in_progress")
    );
    return activeTask?.title;
  }

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
          <div className="space-y-3">
            {getAgentRuns(selectedAgent).length === 0 ? (
              <div className="bg-white rounded-xl p-4 shadow-sm text-center">
                <p className="text-slate-400 text-sm">No runs yet</p>
              </div>
            ) : (
              getAgentRuns(selectedAgent).map((run: AgentRun) => (
                <div key={run._id} className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold text-slate-800">
                      {findTaskTitle(run.taskId) || "Unlinked task"}
                    </div>
                    <span className="text-xs text-slate-400">
                      {run.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">Progress: {run.progress}%</div>
                  <details>
                    <summary className="text-xs text-slate-500 cursor-pointer">View result</summary>
                    <pre className="mt-1 p-2 bg-slate-50 rounded text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {run.response || run.prompt}
                    </pre>
                  </details>
                  {run.blockers && run.blockers.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      Blocked: {run.blockers.join("; ")}
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
