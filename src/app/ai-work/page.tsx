"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import AppFooter from "@/components/AppFooter";
import MarkdownResponse from "@/components/MarkdownResponse";
import FileAttachmentBlockShared, { parseFileAttachments } from "@/components/FileAttachmentBlock";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

interface Task {
  _id: string;
  title: string;
  description?: string;
  status: string;
  agent?: string;
  isAI: boolean;
  aiStatus?: string;
  aiProgress?: number;
  aiResponse?: string;
  aiResponseShort?: string;
  aiBlockers?: string[];
  openclawSessionId?: string;
  openclawTaskId?: string;
  createdAt: number;
  updatedAt: number;
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

const AGENTS: Record<string, { name: string; emoji: string; color: string }> = {
  main: { name: "Vertex (General Agent)", emoji: "🧠", color: "text-slate-500" },
  researcher: { name: "Scout (Research Agent)", emoji: "🔍", color: "text-blue-500" },
  writer: { name: "Writer (Writing Agent)", emoji: "✍️", color: "text-purple-500" },
  editor: { name: "Editor (Editing Agent)", emoji: "📝", color: "text-orange-500" },
  coordinator: { name: "Nexus (Coordinator Agent)", emoji: "🎯", color: "text-teal-500" },
};

const getAgentInfo = (agentId?: string) => agentId ? AGENTS[agentId] : undefined;

const getRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
};

function AIWorkContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const focusedTaskId = searchParams.get("task");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const tasksQuery = useQuery(api.tasks.getTasks);
  const runsQuery = useQuery(api.agentRuns.getAgentRuns);
  const isLoading = tasksQuery === undefined || runsQuery === undefined;
  const updateTaskStatus = useMutation(api.tasks.updateTaskStatus);
  const updateAIProgress = useMutation(api.tasks.updateAIProgress);
  const deleteTask = useMutation(api.tasks.deleteTask);
  const [stoppingTasks, setStoppingTasks] = useState<Set<string>>(new Set());
  const [deletingTasks, setDeletingTasks] = useState<Set<string>>(new Set());
  const [retryingTasks, setRetryingTasks] = useState<Set<string>>(new Set());
  const [continueChatInput, setContinueChatInput] = useState("");
  const [sendingContinue, setSendingContinue] = useState(false);
  const continueChatRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<Set<string>>(new Set());
  // Per-task polling attempt counters and consecutive-error counters
  const pollAttemptsRef = useRef<Map<string, number>>(new Map());
  const poll502CountRef = useRef<Map<string, number>>(new Map());
  // Local chat messages for the focused task continue-chat thread
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string; id: string }[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Track the last aiResponse we've already shown in chatMessages to avoid duplicate appends
  const lastSeenAiResponseRef = useRef<string | null>(null);
  
  const tasks = (tasksQuery || []) as Task[];
  const allRuns = (runsQuery || []) as AgentRun[];
  // Filter runs to only those with matching task IDs (avoid orphaned runs)
  const taskIdSet = new Set(tasks.map(t => t._id));
  const runs = allRuns.filter(run => run.taskId && taskIdSet.has(run.taskId));
  
  const aiTasks = tasks.filter(t => t.isAI);
  const focusedTask = focusedTaskId ? tasks.find(t => t._id === focusedTaskId) : null;

  // Max total polling attempts per task (60 × 5s = 5 minutes)
  const POLL_MAX_ATTEMPTS = 60;
  // Max consecutive 502/gateway-down responses before giving up
  const POLL_MAX_CONSECUTIVE_502 = 5;

  const startPollingTask = async (task: Task) => {
    if (!task.openclawSessionId || pollingRef.current.has(task._id)) return;
    pollingRef.current.add(task._id);

    // Increment total attempt counter
    const attempts = (pollAttemptsRef.current.get(task._id) ?? 0) + 1;
    pollAttemptsRef.current.set(task._id, attempts);
    console.log(`[poll] task=${task._id} attempt=${attempts}/${POLL_MAX_ATTEMPTS}`);

    try {
      const statusRes = await fetch(`/api/openclaw/status/${encodeURIComponent(task.openclawSessionId)}`);

      // Gateway down or server error
      if (!statusRes.ok) {
        const consecutive502 = (poll502CountRef.current.get(task._id) ?? 0) + 1;
        poll502CountRef.current.set(task._id, consecutive502);
        console.warn(`[poll] task=${task._id} non-ok status=${statusRes.status} consecutive=${consecutive502}`);

        if (consecutive502 >= POLL_MAX_CONSECUTIVE_502) {
          console.error(`[poll] task=${task._id} reached ${POLL_MAX_CONSECUTIVE_502} consecutive gateway errors — marking failed`);
          await updateAIProgress({
            id: task._id as Id<"tasks">,
            aiStatus: "failed",
            aiProgress: 0,
            aiResponseShort: `OpenClaw unreachable after ${consecutive502} attempts (HTTP ${statusRes.status})`,
          });
          pollAttemptsRef.current.delete(task._id);
          poll502CountRef.current.delete(task._id);
        }
        return;
      }

      // Successful HTTP response — reset consecutive-502 counter
      poll502CountRef.current.set(task._id, 0);

      const statusData = await statusRes.json();
      console.log(`[poll] task=${task._id} openclawStatus=${statusData?.status}`);

      if (statusData?.status === "completed") {
        const historyRes = await fetch(`/api/openclaw/sessions/${encodeURIComponent(task.openclawSessionId)}?limit=200`);
        if (!historyRes.ok) {
          console.warn(`[poll] task=${task._id} failed to fetch session history (${historyRes.status})`);
          return;
        }
        const historyData = await historyRes.json();
        const messages = Array.isArray(historyData?.messages) ? historyData.messages : [];

        let responseText = "";
        for (const entry of messages) {
          const msg = (entry as any)?.message;
          if (!msg || msg.role !== "assistant") continue;
          const content = Array.isArray(msg.content) ? msg.content : [];
          const textParts = content
            .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
            .map((part: any) => part.text);
          if (textParts.length > 0) {
            responseText += (responseText ? "\n\n" : "") + textParts.join("\n");
          }
        }

        const responseShort = responseText ? responseText.slice(0, 200) : undefined;

        console.log(`[poll] task=${task._id} completed — saving response (${responseText.length} chars)`);
        await updateAIProgress({
          id: task._id as Id<"tasks">,
          aiStatus: "completed",
          aiProgress: 100,
          aiResponse: responseText || undefined,
          aiResponseShort: responseShort,
        });
        // Clean up counters on success
        pollAttemptsRef.current.delete(task._id);
        poll502CountRef.current.delete(task._id);
      } else if (attempts >= POLL_MAX_ATTEMPTS) {
        // Still running after max attempts
        console.error(`[poll] task=${task._id} exceeded max attempts (${POLL_MAX_ATTEMPTS}) — marking failed`);
        await updateAIProgress({
          id: task._id as Id<"tasks">,
          aiStatus: "failed",
          aiProgress: 0,
          aiResponseShort: `Timed out after ${POLL_MAX_ATTEMPTS} polling attempts (~5 minutes)`,
        });
        pollAttemptsRef.current.delete(task._id);
        poll502CountRef.current.delete(task._id);
      }
    } catch (err) {
      console.error(`[poll] task=${task._id} network error:`, err);
      const consecutive502 = (poll502CountRef.current.get(task._id) ?? 0) + 1;
      poll502CountRef.current.set(task._id, consecutive502);
      if (consecutive502 >= POLL_MAX_CONSECUTIVE_502) {
        console.error(`[poll] task=${task._id} ${consecutive502} consecutive network errors — marking failed`);
        await updateAIProgress({
          id: task._id as Id<"tasks">,
          aiStatus: "failed",
          aiProgress: 0,
          aiResponseShort: `Network error after ${consecutive502} consecutive failures`,
        });
        pollAttemptsRef.current.delete(task._id);
        poll502CountRef.current.delete(task._id);
      }
    } finally {
      pollingRef.current.delete(task._id);
    }
  };

  useEffect(() => {
    const runningTasks = aiTasks.filter(
      (t) => t.aiStatus === "running" && t.openclawSessionId
    );

    if (runningTasks.length === 0) return;

    const interval = setInterval(() => {
      runningTasks.forEach((task) => {
        startPollingTask(task).catch(() => {});
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [aiTasks]);

  // When the focused task's aiResponse changes (Convex reactive update), append the
  // new response as an assistant message in the local chat thread — but only if
  // the user has already sent a message (so we don't spam the thread on initial load)
  // and only if we haven't already shown this exact response text.
  useEffect(() => {
    if (!focusedTask) return;
    const newResponse = focusedTask.aiResponse;
    if (!newResponse) return;
    // Only append after the user has sent at least one continue-chat message
    const userSent = chatMessages.some(m => m.role === "user");
    if (!userSent) return;
    // Avoid duplicate appends
    if (lastSeenAiResponseRef.current === newResponse) return;
    lastSeenAiResponseRef.current = newResponse;
    const assistantMsgId = `assistant-${Date.now()}`;
    setChatMessages(prev => [...prev, { role: "assistant", content: newResponse, id: assistantMsgId }]);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [focusedTask?.aiResponse]);

  // Get runs sorted by most recent
  const getFilteredRuns = () => {
    let filtered = [...runs].sort((a, b) => b.startedAt - a.startedAt);
    if (selectedAgent) {
      filtered = filtered.filter(r => r.agent === selectedAgent);
    }
    return filtered;
  };

  const findTask = (taskId?: string) => tasks.find(t => t._id === taskId);

  const handleStopTask = async (taskId: string) => {
    setStoppingTasks(prev => new Set(prev).add(taskId));
    try {
      await updateAIProgress({
        id: taskId as Id<"tasks">,
        aiStatus: "failed",
        aiProgress: 0,
        aiResponseShort: "Stopped by user",
      });
    } catch (err) {
      console.error("Failed to stop task:", err);
    } finally {
      setStoppingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeletingTasks(prev => new Set(prev).add(taskId));
    try {
      await deleteTask({ id: taskId as Id<"tasks"> });
    } catch (err) {
      console.error("Failed to delete task:", err);
    } finally {
      setDeletingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Retry a blocked/failed task by calling execute API again
  const handleRetryTask = async (taskId: string, taskTitle: string, taskDescription?: string) => {
    setRetryingTasks(prev => new Set(prev).add(taskId));
    try {
      // Reset task status
      await updateAIProgress({
        id: taskId as Id<"tasks">,
        aiStatus: "running",
        aiProgress: 10,
        aiResponseShort: "Retrying...",
        aiBlockers: [],
      });
      
      // Re-execute via OpenClaw
      const task = tasks.find(t => t._id === taskId);
      await fetch("/api/openclaw/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: task?.title || taskTitle,
          description: task?.description || taskDescription,
          agent: task?.agent,
          taskId: taskId,
        }),
      });
    } catch (err) {
      console.error("Failed to retry task:", err);
    } finally {
      setRetryingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Continue an existing AI session with a follow-up message
  const handleContinueChat = async (task: Task, message: string) => {
    if (!message.trim() || sendingContinue) return;
    setSendingContinue(true);
    setContinueChatInput("");

    // Append user message immediately
    const userMsgId = `user-${Date.now()}`;
    setChatMessages(prev => [...prev, { role: "user", content: message.trim(), id: userMsgId }]);
    // Scroll to bottom after state update
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      // Set task back to running
      await updateAIProgress({
        id: task._id as Id<"tasks">,
        aiStatus: "running",
        aiProgress: 10,
        aiResponseShort: "Continuing...",
      });
      await updateTaskStatus({ id: task._id as Id<"tasks">, status: "in_progress" });

      // Send follow-up to OpenClaw using the same session
      const res = await fetch("/api/openclaw/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: message.trim(),
          description: undefined,
          agent: task.agent,
          taskId: task._id,
          sessionId: task.openclawSessionId || undefined,
        }),
      });
      if (!res.ok) {
        console.error("Continue chat failed:", await res.text());
        setChatMessages(prev => [...prev, { role: "assistant", content: "Error: failed to send message. Check that OpenClaw is running.", id: `err-${Date.now()}` }]);
      }
    } catch (err) {
      console.error("Continue chat error:", err);
      setChatMessages(prev => [...prev, { role: "assistant", content: "Error: could not reach OpenClaw.", id: `err-${Date.now()}` }]);
    } finally {
      setSendingContinue(false);
    }
  };

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case "completed": return { icon: "rate_review", color: "text-amber-500", label: "Review" };
      case "running": return { icon: "sync", color: "text-blue-500", label: "Running" };
      case "blocked": return { icon: "error", color: "text-red-400", label: "Blocked" };
      case "failed": return { icon: "cancel", color: "text-red-500", label: "Failed" };
      default: return { icon: "schedule", color: "text-gray-400", label: "Pending" };
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-secondary)] text-sm font-light">Loading...</p>
      </div>
    );
  }

  // If a specific task is focused, show its detailed view
  if (focusedTask) {
    const taskRuns = runs
      .filter(r => r.taskId === focusedTask._id)
      .sort((a, b) => b.startedAt - a.startedAt);
    const agentInfo = getAgentInfo(focusedTask.agent);
    const statusInfo = getStatusIndicator(focusedTask.aiStatus || "pending");

    return (
      <div className="h-screen overflow-hidden relative flex flex-col bg-[var(--background)]">
        <header className="pt-14 pb-4 px-6 bg-[var(--background)]/80 backdrop-blur-sm z-10 border-b border-[var(--border)]">
          <button onClick={() => router.back()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-light flex items-center gap-1 mb-3">
            <span className="material-icons text-[16px]">arrow_back</span>
            Back
          </button>
          <h1 className="font-display text-xl font-light text-[var(--text-primary)] mb-1">{focusedTask.title}</h1>
          <div className="flex items-center gap-3">
            {agentInfo && (
              <span className={`text-[11px] font-medium tracking-wide uppercase ${agentInfo.color}`}>
                {agentInfo.emoji} {agentInfo.name}
              </span>
            )}
            <span className={`text-[11px] flex items-center gap-0.5 ${statusInfo.color}`}>
              <span className="material-icons text-[12px]">{statusInfo.icon}</span>
              {statusInfo.label}
            </span>
            {focusedTask.aiStatus === "running" && (
              <button
                onClick={() => handleStopTask(focusedTask._id)}
                disabled={stoppingTasks.has(focusedTask._id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-40"
              >
                <span className="material-icons text-[13px]">stop_circle</span>
                {stoppingTasks.has(focusedTask._id) ? "Stopping..." : "Stop"}
              </button>
            )}
            {(focusedTask.aiStatus === "blocked" || focusedTask.aiStatus === "failed") && (
              <button
                onClick={() => handleRetryTask(focusedTask._id, focusedTask.title, focusedTask.description)}
                disabled={retryingTasks.has(focusedTask._id)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-blue-500 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 transition-colors disabled:opacity-40"
              >
                <span className="material-icons text-[13px]">refresh</span>
                {retryingTasks.has(focusedTask._id) ? "Retrying..." : "Retry"}
              </button>
            )}
            <button
              onClick={() => handleDeleteTask(focusedTask._id)}
              disabled={deletingTasks.has(focusedTask._id)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] hover:text-red-500 bg-[var(--background)]/50 hover:bg-red-500/10 border border-[var(--border)] hover:border-red-500/20 transition-colors disabled:opacity-40"
            >
              <span className="material-icons text-[13px]">delete_outline</span>
              {deletingTasks.has(focusedTask._id) ? "..." : "Delete"}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-32 pt-6">
          {/* Full AI Response */}
          {focusedTask.aiResponse && (
            <div className="mb-8">
              <h2 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 opacity-70">AI Response</h2>
               <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-5 shadow-sm">
                <MarkdownResponse content={focusedTask.aiResponse} />
                {/* File attachments from AI response */}
                <FileAttachmentBlockShared attachments={parseFileAttachments(focusedTask.aiResponse || "")} />
              </div>
            </div>
          )}

          {/* Blockers */}
          {focusedTask.aiBlockers && focusedTask.aiBlockers.length > 0 && (
            <div className="mb-8">
              <h2 className="text-[11px] font-medium text-red-400 uppercase tracking-wider mb-3">Blockers</h2>
              <div className="space-y-3">
                {focusedTask.aiBlockers.map((blocker, i) => (
                  <div key={i} className="flex items-start gap-3 text-[13px] text-red-400 font-light bg-red-400/5 p-3 rounded-xl border border-red-400/20">
                    <span className="material-icons text-[16px] mt-0.5">warning</span>
                    {blocker}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Runs for this task */}
          {taskRuns.length > 0 && (
            <div>
              <h2 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 opacity-70">
                Run History ({taskRuns.length})
              </h2>
              <div className="space-y-4">
                {taskRuns.map((run) => {
                  const runStatus = getStatusIndicator(run.status);
                  return (
                    <div key={run._id} className="border-b border-[var(--border)] pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-[11px] flex items-center gap-1 ${runStatus.color} font-medium`}>
                          <span className="material-icons text-[14px]">{runStatus.icon}</span>
                          {runStatus.label}
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)] font-light opacity-60">
                          {getRelativeTime(run.startedAt)}
                        </span>
                      </div>
                      {run.response && (
                        <div className="mt-2 opacity-90">
                          <MarkdownResponse content={run.response} compact />
                          <FileAttachmentBlockShared attachments={parseFileAttachments(run.response)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!focusedTask.aiResponse && taskRuns.length === 0 && (
            <div className="text-center py-20 opacity-40">
              <span className="material-icons text-4xl text-[var(--text-secondary)]">hourglass_empty</span>
              <p className="text-[var(--text-secondary)] mt-3 text-sm font-light">
                {focusedTask.aiStatus === "running" ? "AI is working on this task..." : "No results yet"}
              </p>
            </div>
          )}
        </main>

        {/* Continue Chat Bar — fixed at bottom */}
        <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--background)]/95 backdrop-blur-sm px-4 pt-3 pb-4">
          {/* Local chat messages thread */}
          {chatMessages.length > 0 && (
            <div className="mb-3 max-h-48 overflow-y-auto hide-scrollbar space-y-2">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] font-light leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--text-primary)] text-[var(--background)] rounded-br-sm"
                      : "bg-[var(--surface)] text-[var(--text-primary)] rounded-bl-sm border border-[var(--border)]"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          )}
          <div className="flex items-end gap-2 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={continueChatRef}
                value={continueChatInput}
                onChange={(e) => {
                  setContinueChatInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleContinueChat(focusedTask, continueChatInput);
                  }
                }}
                placeholder={
                  focusedTask.aiStatus === "running"
                    ? "AI is working..."
                    : "Continue this task... (Enter to send, Shift+Enter for newline)"
                }
                disabled={focusedTask.aiStatus === "running" || sendingContinue}
                rows={1}
                className="w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] text-[14px] font-light px-4 py-3 pr-12 placeholder:text-[var(--text-secondary)] placeholder:opacity-40 focus:outline-none focus:border-[var(--text-primary)]/30 disabled:opacity-40 transition-colors leading-snug"
                style={{ minHeight: "44px", maxHeight: "120px", overflowY: "auto" }}
              />
            </div>
            <button
              onClick={() => handleContinueChat(focusedTask, continueChatInput)}
              disabled={!continueChatInput.trim() || focusedTask.aiStatus === "running" || sendingContinue}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--text-primary)] text-[var(--background)] flex items-center justify-center hover:opacity-80 active:scale-95 transition-all disabled:opacity-30"
              title="Send follow-up"
            >
              {sendingContinue ? (
                <span className="material-icons text-[18px] animate-spin">sync</span>
              ) : (
                <span className="material-icons text-[18px]">arrow_upward</span>
              )}
            </button>
          </div>
          <p className="text-center text-[10px] text-[var(--text-secondary)] opacity-30 mt-1.5 font-light">
            Continues the same AI session · Mark done by checking the circle in Tasks
          </p>
        </div>
      </div>
    );
  }

  // Default: list all AI work
  const filteredRuns = getFilteredRuns();
  const agentIds = Object.keys(AGENTS);

  return (
    <div className="h-screen overflow-hidden relative flex flex-col bg-[var(--background)]">
      <header className="pt-14 pb-4 px-6 bg-[var(--background)]/80 backdrop-blur-sm z-10 border-b border-[var(--border)]">
        <button onClick={() => router.back()} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors text-sm font-light flex items-center gap-1 mb-3">
          <span className="material-icons text-[16px]">arrow_back</span>
          Back
        </button>
        <h1 className="font-display text-2xl font-light text-[var(--text-primary)] mb-5">AI Work</h1>
        
        {/* Agent filter pills */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          <button
            onClick={() => setSelectedAgent(null)}
            className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
              !selectedAgent
                ? "bg-[var(--text-primary)] text-[var(--background)] border-[var(--text-primary)]"
                : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]"
            }`}
          >
            All
          </button>
          {agentIds.map((id) => {
            const agent = AGENTS[id];
            return (
              <button
                key={id}
                onClick={() => setSelectedAgent(selectedAgent === id ? null : id)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                  selectedAgent === id
                    ? "bg-[var(--text-primary)] text-[var(--background)] border-[var(--text-primary)]"
                    : "bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]"
                }`}
              >
                {agent.emoji} {agent.name}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar px-6 pb-32 pt-4">
        {/* Active AI Tasks */}
        {aiTasks.filter(t => t.aiStatus === "running").length > 0 && (
          <div className="mb-8">
            <h2 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-3 opacity-70">Currently Running</h2>
            <div className="space-y-2">
              {aiTasks.filter(t => t.aiStatus === "running").map(task => {
                const agentInfo = getAgentInfo(task.agent);
                const isStopping = stoppingTasks.has(task._id);
                const isDeleting = deletingTasks.has(task._id);
                return (
                  <div
                    key={task._id}
                    className="rounded-2xl border border-blue-500/20 bg-blue-500/5 overflow-hidden"
                  >
                    <Link
                      href={`/ai-work?task=${task._id}`}
                      className="group py-4 px-4 flex items-center justify-between hover:bg-blue-500/10 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                        <div>
                          <p className="text-[15px] text-[var(--text-primary)] font-medium">{task.title}</p>
                          {agentInfo && (
                            <p className={`text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${agentInfo.color}`}>
                              {agentInfo.emoji} {agentInfo.name}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="material-icons text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity">
                        chevron_right
                      </span>
                    </Link>
                    <div className="flex items-center gap-2 px-4 pb-3 -mt-1">
                      <button
                        onClick={(e) => { e.preventDefault(); handleStopTask(task._id); }}
                        disabled={isStopping}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-40"
                      >
                        <span className="material-icons text-[14px]">{isStopping ? "hourglass_empty" : "stop_circle"}</span>
                        {isStopping ? "Stopping..." : "Stop"}
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); handleDeleteTask(task._id); }}
                        disabled={isDeleting}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--background)]/50 hover:bg-[var(--background)] border border-[var(--border)] transition-colors disabled:opacity-40"
                      >
                        <span className="material-icons text-[14px]">{isDeleting ? "hourglass_empty" : "delete_outline"}</span>
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed AI Work */}
        {filteredRuns.length > 0 ? (
          <div>
            <h2 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-4 opacity-70">
              Work History ({filteredRuns.length})
            </h2>
            <div className="space-y-3">
              {filteredRuns.map((run) => {
                const task = findTask(run.taskId);
                const agentInfo = getAgentInfo(run.agent);
                const statusInfo = getStatusIndicator(run.status);
                const isExpanded = expandedRun === run._id;

                return (
                  <div
                    key={run._id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden transition-all shadow-sm"
                  >
                    <div 
                      className="flex items-start justify-between p-4 cursor-pointer hover:bg-[var(--background)]/50 transition-colors"
                      onClick={() => setExpandedRun(isExpanded ? null : run._id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[14px] text-[var(--text-primary)] font-medium truncate">
                            {task?.title || "Unknown task"}
                          </p>
                          <span className={`material-icons text-[14px] flex-shrink-0 ${statusInfo.color}`}>
                            {statusInfo.icon}
                          </span>
                        </div>
                        {agentInfo && (
                          <p className={`text-[10px] font-semibold tracking-wider uppercase ${agentInfo.color}`}>
                            {agentInfo.emoji} {agentInfo.name}
                          </p>
                        )}
                        {!isExpanded && run.response && (
                          <p className="text-[12px] text-[var(--text-secondary)] font-light mt-1.5 line-clamp-1 opacity-80">
                            {run.response}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <span className="text-[11px] text-[var(--text-secondary)] font-light opacity-60">
                          {getRelativeTime(run.startedAt)}
                        </span>
                        <span className={`material-icons text-[var(--text-secondary)] opacity-40 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                          expand_more
                        </span>
                      </div>
                    </div>

                    {/* Expanded response */}
                    {isExpanded && (
                      <div className="p-4 pt-0 border-t border-[var(--border)] bg-[var(--background)]/30">
                        {run.response ? (
                          <div className="mt-4 bg-[var(--surface)]/50 border border-[var(--border)] rounded-xl p-4">
                            <MarkdownResponse content={run.response} />
                            <FileAttachmentBlockShared attachments={parseFileAttachments(run.response)} />
                          </div>
                        ) : (
                          <p className="text-[12px] text-[var(--text-secondary)] font-light italic mt-4 opacity-50">No response recorded</p>
                        )}
                        {run.blockers && run.blockers.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {run.blockers.map((b, i) => (
                              <span key={i} className="text-[10px] bg-red-400/10 text-red-400 px-2.5 py-1 rounded-full font-medium border border-red-400/20">
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                        {task && (
                          <Link
                            href={`/ai-work?task=${task._id}`}
                            className="inline-flex items-center gap-1.5 mt-4 text-[11px] text-blue-500 hover:text-blue-600 transition-colors font-medium"
                          >
                            <span className="material-icons text-[14px]">open_in_new</span>
                            View full task details
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 opacity-30">
            <span className="material-icons text-5xl text-[var(--text-secondary)]">auto_awesome</span>
            <p className="text-[var(--text-secondary)] mt-4 text-sm font-light">No AI work yet</p>
            <p className="text-[var(--text-secondary)] mt-1 text-xs font-light">Create an AI task to get started</p>
          </div>
        )}

        {/* AI Tasks without runs (directly from task data) */}
        {filteredRuns.length === 0 && aiTasks.filter(t => t.aiResponse).length > 0 && (
          <div className="mt-4">
            <h2 className="text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-4 opacity-70">
              Completed Tasks
            </h2>
            <div className="space-y-2">
              {aiTasks.filter(t => t.aiResponse).map(task => {
                const agentInfo = getAgentInfo(task.agent);
                return (
                  <Link
                    key={task._id}
                    href={`/ai-work?task=${task._id}`}
                    className="group py-4 px-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] flex items-start justify-between hover:bg-[var(--background)] transition-all shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-[var(--text-primary)] font-medium">{task.title}</p>
                      {agentInfo && (
                        <p className={`text-[10px] font-semibold tracking-wider uppercase mt-0.5 ${agentInfo.color}`}>
                          {agentInfo.emoji} {agentInfo.name}
                        </p>
                      )}
                      {task.aiResponseShort && (
                        <p className="text-[12px] text-[var(--text-secondary)] font-light mt-2 line-clamp-1 opacity-80">
                          {task.aiResponseShort}
                        </p>
                      )}
                    </div>
                    <span className="material-icons text-[var(--text-secondary)] opacity-40 group-hover:opacity-100 transition-opacity ml-4">
                      chevron_right
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <AppFooter />

      {/* Ambient gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] ambient-gradient-blue rounded-full blur-3xl opacity-20 dark:opacity-10"></div>
        <div className="absolute top-[40%] -left-[10%] w-[300px] h-[300px] ambient-gradient-rose rounded-full blur-3xl opacity-20 dark:opacity-10"></div>
      </div>
    </div>
  );
}

export default function AIWorkPage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-secondary)] text-sm font-light">Loading...</p>
      </div>
    }>
      <AIWorkContent />
    </Suspense>
  );
}
