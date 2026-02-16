"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import AddTaskButton from "@/components/AddTaskButton";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

interface AgentStats {
  id: string;
  name: string;
  emoji: string;
  status: "idle" | "active" | "blocked";
  currentTask?: string;
  tasksCompleted: number;
  totalRuns: number;
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

interface Session {
  _id: string;
  sessionId: string;
  name: string;
  agent: string;
  status: string;
  taskCount: number;
  lastTaskId?: string;
  lastTaskTitle?: string;
  createdAt: number;
  updatedAt: number;
}

// Simple session list component
function SessionList() {
  const sessions = (useQuery(api.sessions.getSessions) || []) as Session[];
  
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 opacity-40">
        <span className="material-icons text-3xl">history</span>
        <p className="text-[var(--text-secondary)] mt-2 text-sm">No sessions yet</p>
        <p className="text-[var(--text-secondary)] text-xs mt-1">Sessions are created when you run AI tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10)
        .map((session) => (
          <div
            key={session._id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg flex-shrink-0">
                {AGENTS_CONFIG.find(a => a.id === session.agent)?.emoji || "🤖"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {session.name}
                </p>
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {session.taskCount} task{session.taskCount !== 1 ? "s" : ""} • {formatTime(session.updatedAt)}
                </p>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${
              session.status === "active" ? "bg-blue-500/20 text-blue-500" :
              session.status === "completed" ? "bg-green-500/20 text-green-500" :
              "bg-red-500/20 text-red-500"
            }`}>
              {session.status}
            </span>
          </div>
        ))}
    </div>
  );
}

const AGENTS_CONFIG = [
  { id: "researcher", name: "Researcher", emoji: "🔍" },
  { id: "writer", name: "Writer", emoji: "✍️" },
  { id: "editor", name: "Editor", emoji: "📝" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯" },
];

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const tasks = (useQuery(api.tasks.getTasks) || []) as Task[];
  const runs = (useQuery(api.agentRuns.getAgentRuns) || []) as AgentRun[];

  const getAgentStats = (): AgentStats[] => {
    return AGENTS_CONFIG.map((agent) => {
      const agentRuns = runs.filter(r => r.agent === agent.id);
      return {
        ...agent,
        status: getAgentStatus(agent.id, runs),
        currentTask: getAgentCurrentTask(agent.id, tasks),
        tasksCompleted: agentRuns.filter(r => r.status === "completed").length,
        totalRuns: agentRuns.length,
      };
    });
  };

  const agents = getAgentStats();

  const getStatusIndicator = (status: AgentStats["status"]) => {
    switch (status) {
      case "active":
        return (
          <div className="flex items-center gap-1.5">
            <div className="flex gap-0.5">
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
            <span className="text-[11px] text-blue-500 font-medium">Working</span>
          </div>
        );
      case "blocked":
        return (
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px] text-red-400">error</span>
            <span className="text-[11px] text-red-400 font-medium">Blocked</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] opacity-40" />
            <span className="text-[11px] text-[var(--text-secondary)]">Idle</span>
          </div>
        );
    }
  };

  const getAgentRuns = (agentId: string) =>
    runs.filter((run: AgentRun) => run.agent === agentId)
      .sort((a, b) => b.startedAt - a.startedAt);

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

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + 
      " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="h-screen overflow-hidden relative flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="pt-12 pb-2 px-6 z-10 bg-[var(--background)]/80 backdrop-blur-sm">
        <h1 className="font-display text-2xl text-[var(--text-primary)]">Agents</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">AI agents working on your tasks</p>
      </header>

      {/* Main scrollable content */}
      <main className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-32 pt-4">
        {/* Agent Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              className={`text-left rounded-2xl p-4 transition-all border ${
                selectedAgent === agent.id
                  ? "bg-blue-500/10 border-blue-500/50"
                  : "bg-[var(--surface)] border-[var(--border)] hover:bg-[var(--surface)]/80"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{agent.emoji}</span>
                {selectedAgent !== agent.id && getStatusIndicator(agent.status)}
              </div>

              <h3 className={`text-sm font-semibold ${
                selectedAgent === agent.id ? "text-blue-500" : "text-[var(--text-primary)]"
              }`}>
                {agent.name}
              </h3>

              {agent.currentTask && agent.status === "active" && (
                <p className={`text-[11px] mt-1 truncate ${
                  selectedAgent === agent.id ? "text-blue-400" : "text-[var(--text-secondary)]"
                }`}>
                  {agent.currentTask}
                </p>
              )}

              <div className="mt-3 flex items-center gap-3">
                <span className={`text-[11px] ${
                  selectedAgent === agent.id ? "text-blue-400/80" : "text-[var(--text-secondary)]"
                }`}>
                  {agent.tasksCompleted} completed
                </span>
                {agent.totalRuns > 0 && (
                  <span className={`text-[11px] ${
                    selectedAgent === agent.id ? "text-blue-400/80" : "text-[var(--text-secondary)]"
                  }`}>
                    {agent.totalRuns} runs
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Selected Agent Run History */}
        {selectedAgent && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg text-[var(--text-primary)]">
                {AGENTS_CONFIG.find(a => a.id === selectedAgent)?.name} History
              </h2>
              <span className="text-xs text-[var(--text-secondary)]">
                {getAgentRuns(selectedAgent).length} runs
              </span>
            </div>

            <div className="space-y-2">
              {getAgentRuns(selectedAgent).length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[var(--text-secondary)] text-sm opacity-50">No runs yet</p>
                </div>
              ) : (
                getAgentRuns(selectedAgent).map((run: AgentRun) => (
                  <details
                    key={run._id}
                    className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                  >
                    <summary className="flex items-center justify-between p-3.5 cursor-pointer list-none">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm text-[var(--text-primary)] truncate ${
                            run.status === "running" ? "font-medium" : ""
                          }`}>
                            {findTaskTitle(run.taskId) || "Unlinked task"}
                          </span>
                          {run.status === "running" && (
                            <div className="flex gap-0.5 flex-shrink-0">
                              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                              <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                            </div>
                          )}
                          {run.status === "completed" && (
                            <span className="material-symbols-outlined text-[14px] text-green-500 flex-shrink-0">check_circle</span>
                          )}
                          {run.status === "failed" && (
                            <span className="material-symbols-outlined text-[14px] text-red-400 flex-shrink-0">error</span>
                          )}
                        </div>
                        <span className="text-[11px] text-[var(--text-secondary)] mt-0.5 block opacity-70">
                          {formatTime(run.startedAt)}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-[18px] text-[var(--text-secondary)] group-open:rotate-180 transition-transform ml-2">
                        expand_more
                      </span>
                    </summary>
                    <div className="px-3.5 pb-3.5 border-t border-[var(--border)]">
                      <div className="mt-3">
                        <p className="text-[11px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider font-semibold opacity-70">Prompt</p>
                        <p className="text-xs text-[var(--text-primary)] leading-relaxed font-light">{run.prompt}</p>
                      </div>
                      {run.response && (
                        <div className="mt-3">
                          <p className="text-[11px] text-[var(--text-secondary)] mb-1 uppercase tracking-wider font-semibold opacity-70">Response</p>
                          <pre className="text-xs text-[var(--text-primary)] whitespace-pre-wrap leading-relaxed bg-[var(--background)]/50 border border-[var(--border)] rounded-lg p-3 max-h-48 overflow-y-auto font-body">
                            {run.response}
                          </pre>
                        </div>
                      )}
                      {run.blockers && run.blockers.length > 0 && (
                        <div className="mt-3">
                          <p className="text-[11px] text-red-400 mb-1 uppercase tracking-wider font-semibold">Blockers</p>
                          <ul className="text-xs text-red-400/90 space-y-0.5 font-light">
                            {run.blockers.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {run.completedAt && (
                        <p className="text-[11px] text-[var(--text-secondary)] mt-3 opacity-50 italic">
                          Completed {formatTime(run.completedAt)}
                        </p>
                      )}
                    </div>
                  </details>
                ))
              )}
            </div>
          </div>
        )}

        {/* Sessions Section */}
        <div className="mt-8">
          <h2 className="font-display text-lg text-[var(--text-primary)] mb-4">Recent Sessions</h2>
          <SessionList />
        </div>
      </main>

      <AddTaskButton />
      <BottomNav />

      {/* Ambient background gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] ambient-gradient-blue rounded-full blur-3xl opacity-20 dark:opacity-10" />
        <div className="absolute top-[40%] -left-[10%] w-[300px] h-[300px] ambient-gradient-rose rounded-full blur-3xl opacity-20 dark:opacity-10" />
      </div>
    </div>
  );
}
