"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import VoiceMode from "./VoiceMode";
import MarkdownResponse from "./MarkdownResponse";
import FileAttachmentBlock, { parseFileAttachments } from "./FileAttachmentBlock";
import {
  filterSessionsByAgent,
  getSessionDisplayName,
  type GatewaySessionRow,
} from "@/lib/openclawGateway";

const AGENTS = [
  { id: "main", name: "Vertex (General Agent)", emoji: "🧠" },
  { id: "researcher", name: "Scout (Research Agent)", emoji: "🔍" },
  { id: "writer", name: "Writer (Writing Agent)", emoji: "✍️" },
  { id: "editor", name: "Editor (Editing Agent)", emoji: "📝" },
  { id: "coordinator", name: "Nexus (Coordinator Agent)", emoji: "🎯" },
];

interface ToolCallInfo {
  id: string;
  name: string;
  arguments: string;
}

interface ThinkingData {
  thinkingText: string;
  toolCalls: ToolCallInfo[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  createdTasks?: { title: string; agent?: string }[];
  thinking?: ThinkingData;
}

// System prompt that teaches the AI how to create tasks and delegate to agents
const TASK_CREATION_SYSTEM_PROMPT = `You are an AI assistant integrated into a task management app. You can create tasks and delegate complex work to specialist agents.

## Creating Tasks

When the user asks you to create a task, add a todo, or anything that implies creating an actionable item, include a JSON block:

[CREATE_TASK]
{"title": "Task title here", "description": "Optional description", "priority": "medium", "agent": "researcher", "tags": ["tag1"]}
[/CREATE_TASK]

## Multi-Agent Delegation

For complex tasks that need multiple steps, you can break them into subtasks and assign them to specialist agents. Each agent picks up tasks automatically via heartbeat polling.

**Available agents:**
- "researcher" — finds information, does web research, gathers data
- "writer" — creates content, drafts documents, writes copy
- "editor" — reviews, proofreads, refines content
- "coordinator" — plans, breaks down tasks, orchestrates work

**To create subtasks under a parent task:**

First create the parent task, then create subtasks referencing it:

[CREATE_TASK]
{"title": "Write blog post about AI trends", "description": "Research, write, and edit a blog post", "agent": "coordinator", "tags": ["blog"], "subtaskMode": "serial"}
[/CREATE_TASK]

[CREATE_SUBTASK parent="Write blog post about AI trends"]
{"title": "Research AI trends 2026", "description": "Find top 5 AI trends with sources", "agent": "researcher", "heartbeatAgentId": "researcher", "priority": "high", "tags": ["research"]}
[/CREATE_SUBTASK]

[CREATE_SUBTASK parent="Write blog post about AI trends" dependsOn="Research AI trends 2026"]
{"title": "Draft blog post", "description": "Write 1000-word blog post based on research", "agent": "writer", "heartbeatAgentId": "writer", "priority": "high", "tags": ["writing"]}
[/CREATE_SUBTASK]

[CREATE_SUBTASK parent="Write blog post about AI trends" dependsOn="Draft blog post"]
{"title": "Edit and polish blog post", "description": "Review for clarity, grammar, and flow", "agent": "editor", "heartbeatAgentId": "editor", "priority": "medium", "tags": ["editing"]}
[/CREATE_SUBTASK]

**Subtask rules:**
- "heartbeatAgentId" (required for subtasks) — which agent picks this up via heartbeat
- "subtaskMode" on parent: "serial" (subtasks depend on each other) or "parallel" (all run at once)
- "dependsOn" — title of the task this depends on (resolved to ID by the system)
- Agents automatically pick up tasks on their next heartbeat (every 15 min)
- Dependencies are checked server-side — agents only see tasks whose deps are all completed

## Field Reference

- "title" — required string
- "description" — optional string
- "priority" — "low" | "medium" | "high" (defaults to "medium")
- "agent" — "researcher" | "writer" | "editor" | "coordinator" (optional, makes it an AI task)
- "tags" — optional array of strings
- "heartbeatAgentId" — which agent picks this up (for delegated subtasks)
- "subtaskMode" — "parallel" | "serial" (on parent task)

You can create multiple tasks/subtasks by including multiple blocks.
Always confirm to the user what was created.
If the request is ambiguous, ask for clarification.

Important: You MUST wrap JSON in [CREATE_TASK] or [CREATE_SUBTASK] markers. Do NOT just describe creating a task.`;

interface ParsedTask {
  title: string;
  description?: string;
  priority?: string;
  agent?: string;
  tags?: string[];
  // Multi-agent fields
  subtaskMode?: string;
  heartbeatAgentId?: string;
  // Subtask linkage (resolved later)
  _parentTitle?: string;
  _dependsOnTitles?: string[];
  isSubtask?: boolean;
}

// Parse [CREATE_TASK] and [CREATE_SUBTASK] blocks from AI response
function parseTaskBlocks(content: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  // Parse standalone tasks
  const taskRegex = /\[CREATE_TASK\]\s*([\s\S]*?)\s*\[\/CREATE_TASK\]/g;
  let match;
  while ((match = taskRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.title && typeof parsed.title === "string") {
        tasks.push({
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority || "medium",
          agent: parsed.agent,
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          subtaskMode: parsed.subtaskMode,
        });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  // Parse subtasks
  const subtaskRegex = /\[CREATE_SUBTASK\s+parent="([^"]+)"(?:\s+dependsOn="([^"]*)")?\]\s*([\s\S]*?)\s*\[\/CREATE_SUBTASK\]/g;
  while ((match = subtaskRegex.exec(content)) !== null) {
    try {
      const parentTitle = match[1];
      const dependsOnStr = match[2] || "";
      const parsed = JSON.parse(match[3].trim());
      if (parsed.title && typeof parsed.title === "string") {
        const dependsOnTitles = dependsOnStr
          ? dependsOnStr.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
        tasks.push({
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority || "medium",
          agent: parsed.agent,
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          heartbeatAgentId: parsed.heartbeatAgentId,
          isSubtask: true,
          _parentTitle: parentTitle,
          _dependsOnTitles: dependsOnTitles,
        });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  return tasks;
}

// Strip [CREATE_TASK] and [CREATE_SUBTASK] blocks from displayed message
function stripTaskBlocks(content: string): string {
  return content
    .replace(/\[CREATE_TASK\]\s*[\s\S]*?\s*\[\/CREATE_TASK\]/g, "")
    .replace(/\[CREATE_SUBTASK\s+[^\]]*\]\s*[\s\S]*?\s*\[\/CREATE_SUBTASK\]/g, "")
    .trim();
}

// Format tool call arguments for display
function formatToolArgs(argsStr: string): string {
  try {
    const parsed = JSON.parse(argsStr);
    if (typeof parsed === "object" && parsed !== null) {
      return Object.entries(parsed)
        .map(([k, v]) => {
          const val = typeof v === "string"
            ? (v.length > 80 ? v.slice(0, 80) + "..." : v)
            : JSON.stringify(v);
          return `${k}: ${val}`;
        })
        .join(", ");
    }
    return argsStr;
  } catch {
    return argsStr.length > 120 ? argsStr.slice(0, 120) + "..." : argsStr;
  }
}

// ThinkingBlock component - collapsible thinking/process viewer
function ThinkingBlock({ thinking, isStreaming }: { thinking: ThinkingData; isStreaming?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);

  const hasContent = thinking.thinkingText.length > 0 || thinking.toolCalls.length > 0;
  if (!hasContent) return null;

  const toolCount = thinking.toolCalls.length;
  const hasThinking = thinking.thinkingText.length > 0;

  // Build summary label
  const summaryParts: string[] = [];
  if (toolCount > 0) summaryParts.push(`${toolCount} tool call${toolCount !== 1 ? "s" : ""}`);
  if (hasThinking) summaryParts.push("reasoning");
  const summaryLabel = summaryParts.join(" + ");

  return (
    <div className="mt-1.5 mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] opacity-60 hover:opacity-90 transition-opacity group"
      >
        <span
          className={`material-icons text-[14px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
        <span className="font-medium">
          {summaryLabel}
        </span>
        {isStreaming && (
          <span className="inline-flex gap-0.5 ml-1">
            <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "100ms" }} />
            <span className="w-1 h-1 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "200ms" }} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mt-1.5 pl-3 border-l border-[var(--border)]/40 space-y-2">
          {/* Tool calls */}
          {thinking.toolCalls.map((tc, i) => (
            <div key={tc.id || i} className="text-[11px] text-[var(--text-secondary)] opacity-70 leading-relaxed font-light">
              <span className="inline-flex items-center gap-1">
                <span className="material-icons text-[11px] opacity-50">build</span>
                <span className="font-medium opacity-80">{tc.name}</span>
              </span>
              {tc.arguments && tc.arguments !== "{}" && (
                <span className="ml-1 opacity-50">
                  ({formatToolArgs(tc.arguments)})
                </span>
              )}
            </div>
          ))}

          {/* Thinking / reasoning text */}
          {hasThinking && (
            <pre className="text-[11px] text-[var(--text-secondary)] opacity-50 font-body font-light whitespace-pre-wrap leading-relaxed">
              {thinking.thinkingText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState<ThinkingData>({
    thinkingText: "",
    toolCalls: [],
  });
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>("main");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("new");
  const [sessions, setSessions] = useState<GatewaySessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageQueueRef = useRef<string[]>([]);

  // Convex mutation for creating tasks
  const createTask = useMutation(api.tasks.createTask);

  const agentSessions = filterSessionsByAgent(sessions, selectedAgent).sort((a, b) => {
    const aTime = a.updatedAt ?? 0;
    const bTime = b.updatedAt ?? 0;
    return bTime - aTime;
  });

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Check connection on mount
  useEffect(() => {
    fetch("/api/openclaw/chat")
      .then((res) => res.json())
      .then((data) => setConnected(data.connected ?? false))
      .catch(() => setConnected(false));
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetch("/api/openclaw/sessions");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to load sessions (${res.status})`);
      }
      const data = await res.json();
      const next = Array.isArray(data.sessions) ? (data.sessions as GatewaySessionRow[]) : [];
      setSessions(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load sessions";
      setSessionsError(msg);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const extractMessageText = (message: unknown): string => {
    if (!message || typeof message !== "object") return "";
    const entry = message as {
      content?: unknown;
      text?: unknown;
    };
    if (typeof entry.content === "string") return entry.content;
    if (Array.isArray(entry.content)) {
      const parts: string[] = [];
      for (const part of entry.content) {
        if (!part || typeof part !== "object") continue;
        const block = part as { type?: string; text?: string };
        if (
          (block.type === "text" || block.type === "input_text" || block.type === "output_text") &&
          typeof block.text === "string" &&
          block.text.trim()
        ) {
          parts.push(block.text);
        }
      }
      return parts.join("\n\n");
    }
    if (typeof entry.text === "string") return entry.text;
    return "";
  };

  const loadSessionHistory = useCallback(
    async (sessionKey: string) => {
      setHistoryLoading(true);
      setError(null);
      setMessages([]);
      try {
        const res = await fetch(
          `/api/openclaw/sessions/${encodeURIComponent(sessionKey)}?limit=200`
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to load history (${res.status})`);
        }
        const data = await res.json();
        const rawMessages = Array.isArray(data.messages) ? data.messages : [];
        const parsed = rawMessages
          .map((msg: unknown, index: number) => {
            if (!msg || typeof msg !== "object") return null;
            const entry = msg as { role?: string; timestamp?: number };
            const role = entry.role === "user" ? "user" : "assistant";
            const content = extractMessageText(msg);
            if (!content) return null;
            return {
              id: `history-${entry.timestamp ?? Date.now()}-${index}`,
              role,
              content,
              timestamp: typeof entry.timestamp === "number" ? entry.timestamp : Date.now(),
            } as ChatMessage;
          })
          .filter((msg: ChatMessage | null): msg is ChatMessage => msg !== null);
        setMessages(parsed);
        setSelectedSessionId(sessionKey);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load session history";
        setError(msg);
      } finally {
        setHistoryLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedSessionId && selectedSessionId !== "new") {
      loadSessionHistory(selectedSessionId);
    }
  }, [selectedSessionId, loadSessionHistory]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Create tasks from parsed AI response, resolving subtask references
  const handleTaskCreation = async (taskDefs: ParsedTask[]) => {
    const created: { title: string; agent?: string }[] = [];
    // Map title -> Convex ID for resolving parent/dependency references
    const titleToId: Record<string, string> = {};

    // First pass: create parent tasks (non-subtasks)
    for (const def of taskDefs) {
      if (def.isSubtask) continue;
      try {
        const isAI = !!def.agent;
        const taskId = await createTask({
          title: def.title,
          description: def.description,
          status: isAI ? "assigned" : "inbox",
          priority: def.priority || "medium",
          tags: def.tags || [],
          isAI,
          agent: def.agent,
          subtaskMode: def.subtaskMode,
        });

        if (taskId) {
          titleToId[def.title] = String(taskId);
        }

        created.push({ title: def.title, agent: def.agent });

        // Fire-and-forget: send AI tasks to OpenClaw for execution
        // (Only for non-parent tasks — parents with subtasks wait for subtask completion)
        const hasSubtasks = taskDefs.some((t) => t._parentTitle === def.title);
        if (isAI && taskId && !hasSubtasks) {
          fetch("/api/openclaw/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: def.title,
              description: def.description,
              agent: def.agent,
              taskId: taskId,
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to create task:", def.title, err);
      }
    }

    // Second pass: create subtasks with resolved references
    for (const def of taskDefs) {
      if (!def.isSubtask) continue;
      try {
        const parentId = def._parentTitle ? titleToId[def._parentTitle] : undefined;
        // Resolve dependsOn titles to IDs
        const dependsOnIds = (def._dependsOnTitles || [])
          .map((t) => titleToId[t])
          .filter(Boolean);

        const isAI = !!def.agent;
        const taskId = await createTask({
          title: def.title,
          description: def.description,
          status: isAI ? "assigned" : "inbox",
          priority: def.priority || "medium",
          tags: def.tags || [],
          isAI,
          agent: def.agent,
          parentTaskId: parentId,
          isSubtask: true,
          createdBy: "coordinator",
          heartbeatAgentId: def.heartbeatAgentId,
          dependsOn: dependsOnIds.length > 0 ? dependsOnIds : undefined,
        });

        if (taskId) {
          titleToId[def.title] = String(taskId);
        }

        created.push({ title: def.title, agent: def.agent });
      } catch (err) {
        console.error("Failed to create subtask:", def.title, err);
      }
    }

    return created;
  };

  const processMessage = async (text: string, allMessages: ChatMessage[]) => {
    setError(null);
    setIsLoading(true);
    setStreamingContent("");
    setStreamingThinking({ thinkingText: "", toolCalls: [] });

    // Mutable accumulators for streaming (avoid stale closure issues)
    let contentAccum = "";
    let thinkingAccum = "";
    const toolCallsAccum: ToolCallInfo[] = [];

    try {
      const systemPrompt = TASK_CREATION_SYSTEM_PROMPT;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...allMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const res = await fetch("/api/openclaw/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          agentId: selectedAgent,
          sessionKey: selectedSessionId !== "new" ? selectedSessionId : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to send message (${res.status})`);
      }

      const contentType = res.headers.get("content-type") || "";

      // Handle SSE streaming response
      if (contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split("\n");
          sseBuffer = lines.pop() || "";

          let eventType = "";
          let dataAccum = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              dataAccum += line.slice(6);
            } else if (line.trim() === "" && dataAccum) {
              // End of event
              try {
                const payload = JSON.parse(dataAccum);

                switch (eventType) {
                  case "delta": {
                    contentAccum += payload.text || "";
                    setStreamingContent(contentAccum);
                    break;
                  }
                  case "thinking": {
                    thinkingAccum += payload.text || "";
                    setStreamingThinking((prev) => ({
                      ...prev,
                      thinkingText: thinkingAccum,
                    }));
                    break;
                  }
                  case "tool_start": {
                    const tc: ToolCallInfo = {
                      id: payload.id || "",
                      name: payload.name || "",
                      arguments: payload.arguments || "",
                    };
                    toolCallsAccum.push(tc);
                    setStreamingThinking((prev) => ({
                      ...prev,
                      toolCalls: [...toolCallsAccum],
                    }));
                    break;
                  }
                  case "tool_end": {
                    // Update arguments for the matching tool call
                    const idx = toolCallsAccum.findIndex(
                      (t) => t.id === payload.id
                    );
                    if (idx >= 0 && payload.arguments) {
                      toolCallsAccum[idx].arguments = payload.arguments;
                      setStreamingThinking((prev) => ({
                        ...prev,
                        toolCalls: [...toolCallsAccum],
                      }));
                    }
                    break;
                  }
                  case "done": {
                    // Use the final content from done event
                    contentAccum = payload.content || contentAccum;
                    if (payload.thinkingText) {
                      thinkingAccum = payload.thinkingText;
                    }
                    if (payload.toolCalls && Array.isArray(payload.toolCalls)) {
                      for (const tc of payload.toolCalls) {
                        if (tc.id && tc.name && !toolCallsAccum.find((t: ToolCallInfo) => t.id === tc.id)) {
                          toolCallsAccum.push(tc);
                        }
                      }
                    }
                    break;
                  }
                  case "error": {
                    throw new Error(payload.message || "Stream error");
                  }
                }
              } catch (parseErr: unknown) {
                // Re-throw actual stream errors, skip JSON parse errors
                if (eventType === "error") throw parseErr;
              }

              eventType = "";
              dataAccum = "";
            }
          }
        }

        // Finalize: create the assistant message with thinking data
        const finalContent = contentAccum;
        if (finalContent || toolCallsAccum.length > 0) {
          const taskDefs = parseTaskBlocks(finalContent);
          const displayContent = stripTaskBlocks(finalContent);
          let createdTasks: { title: string; agent?: string }[] = [];

          if (taskDefs.length > 0) {
            createdTasks = await handleTaskCreation(taskDefs);
          }

          const thinkingData: ThinkingData = {
            thinkingText: thinkingAccum,
            toolCalls: [...toolCallsAccum],
          };

          const hasThinking =
            thinkingData.thinkingText.length > 0 ||
            thinkingData.toolCalls.length > 0;

          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content:
              displayContent ||
              (createdTasks.length > 0
                ? `Created ${createdTasks.length} task(s).`
                : finalContent),
            timestamp: Date.now(),
            createdTasks:
              createdTasks.length > 0 ? createdTasks : undefined,
            thinking: hasThinking ? thinkingData : undefined,
          };

          setMessages((prev) => [...prev, assistantMsg]);
          setConnected(true);
        }
      } else {
        // Fallback: non-streaming JSON response
        const data = await res.json();
        if (data.content) {
          const taskDefs = parseTaskBlocks(data.content);
          const displayContent = stripTaskBlocks(data.content);
          let createdTasks: { title: string; agent?: string }[] = [];

          if (taskDefs.length > 0) {
            createdTasks = await handleTaskCreation(taskDefs);
          }

          const assistantMsg: ChatMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content:
              displayContent ||
              (createdTasks.length > 0
                ? `Created ${createdTasks.length} task(s).`
                : data.content),
            timestamp: Date.now(),
            createdTasks:
              createdTasks.length > 0 ? createdTasks : undefined,
          };

          setMessages((prev) => [...prev, assistantMsg]);
          setConnected(true);
        }
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Could not reach AI agent. Is OpenClaw running?";
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${errMsg}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      setStreamingThinking({ thinkingText: "", toolCalls: [] });

      // Refresh sessions list to pick up any new sessions
      loadSessions();

      // Process queued messages
      if (messageQueueRef.current.length > 0) {
        const nextMsg = messageQueueRef.current.shift()!;
        setTimeout(() => {
          const userMsg: ChatMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: nextMsg,
            timestamp: Date.now(),
          };
          setMessages((prev) => {
            const updated = [...prev, userMsg];
            processMessage(nextMsg, updated);
            return updated;
          });
        }, 100);
      }
    }
  };

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setInput("");

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    // If currently loading, queue the message
    if (isLoading) {
      messageQueueRef.current.push(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          role: "user",
          content: trimmed,
          timestamp: Date.now(),
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    await processMessage(trimmed, updatedMessages);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setError(null);
    setInput("");
    setStreamingContent("");
    setStreamingThinking({ thinkingText: "", toolCalls: [] });
    setSelectedSessionId("new");
    messageQueueRef.current = [];
  };

  // Handle agent change — reset session and chat
  const handleAgentChange = (agentId: string | undefined) => {
    setSelectedAgent(agentId);
    setSelectedSessionId("new");
    // Clear chat when switching agents for a clean slate
    setMessages([]);
    setError(null);
    setStreamingContent("");
    setStreamingThinking({ thinkingText: "", toolCalls: [] });
    messageQueueRef.current = [];
  };

  // Check if streaming has thinking data to show
  const hasStreamingThinking =
    streamingThinking.thinkingText.length > 0 ||
    streamingThinking.toolCalls.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Chat header row 1: Title + New + Voice */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="material-icons text-[18px] text-[var(--text-secondary)]">chat</span>
          <h2 className="font-display text-lg font-light text-[var(--text-primary)]">Chat</h2>
          <div className={`w-1.5 h-1.5 rounded-full ${
            connected === true ? "bg-green-500" : connected === false ? "bg-red-400" : "bg-[var(--text-secondary)] opacity-30"
          }`} title={connected ? "Connected" : "Disconnected"} />
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={startNewChat}
              className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-light flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--surface)]"
            >
              <span className="material-icons text-[14px]">add</span>
              New
            </button>
          )}
          <button
            onClick={() => setVoiceModeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-all active:scale-95"
            title="Voice Mode - Hands free conversation"
          >
            <span className="material-icons text-[16px]">mic</span>
            <span className="text-[11px] font-medium">Voice</span>
          </button>
        </div>
      </div>

      {/* Chat header row 2: Agent selector + Session selector */}
      <div className="flex items-center gap-2 mb-3">
        {/* Agent selector */}
        <select
          value={selectedAgent || ""}
          onChange={(e) => handleAgentChange(e.target.value || undefined)}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] focus:border-blue-500 focus:outline-none text-[12px] font-medium text-[var(--text-primary)] truncate"
        >
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>

        {/* Session selector - shows for all agents including General Agent */}
        {selectedAgent && (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] focus:border-blue-500 focus:outline-none text-[12px] font-light text-[var(--text-primary)] truncate"
            >
              <option value="new">+ New Session</option>
              {sessionsLoading && (
                <option disabled value="loading">
                  Loading sessions...
                </option>
              )}
              {agentSessions.map((session) => {
                const timeAgo = session.updatedAt ? getTimeAgo(session.updatedAt) : "unknown";
                const label = getSessionDisplayName(session);
                return (
                  <option key={session.key} value={session.key}>
                    {label} ({timeAgo})
                  </option>
                );
              })}
            </select>
            <button
              onClick={() => loadSessions()}
              disabled={sessionsLoading}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
              title="Refresh sessions"
            >
              <span className={`material-icons text-[16px] ${sessionsLoading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          </div>
        )}

      </div>

      {sessionsError && selectedAgent && (
        <div className="mb-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-500">
          {sessionsError}
        </div>
      )}

      {/* Session context hint */}
      {selectedAgent && selectedSessionId !== "new" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 mb-2 text-[11px] text-blue-500 bg-blue-500/5 rounded-lg border border-blue-500/10">
          <span className="material-icons text-[12px]">history</span>
          <span className="font-light">Continuing in existing session — agent retains prior context</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3 pb-4">
        {messages.length === 0 && !isLoading && !historyLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons text-4xl text-[var(--border)] mb-3 opacity-30">chat</span>
            <p className="text-[var(--text-primary)] text-sm font-light mb-1 opacity-80">Chat with your AI agent</p>
            <p className="text-[var(--text-secondary)] text-xs font-light max-w-[260px] opacity-50 leading-relaxed">
              Ask questions, get help with tasks, or have the agent create and manage tasks for you.
            </p>
          </div>
        )}

        {historyLoading && (
          <div className="flex justify-center">
            <span className="text-[11px] text-[var(--text-secondary)] opacity-60 font-light">
              Loading session history...
            </span>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user"
                  ? "bg-[var(--text-primary)] text-[var(--background)] rounded-br-sm"
                  : msg.id.startsWith("error-")
                    ? "bg-red-500/10 text-red-500 rounded-bl-sm border border-red-500/20"
                    : "bg-[var(--surface)] text-[var(--text-primary)] rounded-bl-sm border border-[var(--border)]"
              }`}
            >
              {msg.role === "assistant" && !msg.id.startsWith("error-") && selectedAgent && (
                <div className="flex items-center gap-1 mb-1 opacity-50">
                  <span className="text-[10px] font-medium">
                    {AGENTS.find(a => a.id === selectedAgent)?.emoji} {AGENTS.find(a => a.id === selectedAgent)?.name}
                  </span>
                </div>
              )}

              {/* Thinking block - collapsed by default */}
              {msg.thinking && (
                <ThinkingBlock thinking={msg.thinking} />
              )}

              {msg.role === "user" ? (
                <pre className="text-[13px] font-body whitespace-pre-wrap leading-relaxed font-light">
                  {msg.content}
                </pre>
              ) : (
                <MarkdownResponse content={msg.content} />
              )}

              {/* Show created tasks indicator */}
              {msg.createdTasks && msg.createdTasks.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[var(--border)]/30 space-y-1">
                  {msg.createdTasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[11px]">
                      <span className="material-icons text-[12px] text-green-500">check_circle</span>
                      <span className="text-[var(--text-secondary)] font-light">
                        Created: {t.title}
                        {t.agent && <span className="ml-1 opacity-60">({t.agent})</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* File attachments */}
              {msg.role === "assistant" && !msg.id.startsWith("error-") && (
                <FileAttachmentBlock attachments={parseFileAttachments(msg.content)} />
              )}
            </div>
          </div>
        ))}

        {/* Streaming assistant message (in-progress) */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] sm:max-w-[75%] bg-[var(--surface)] rounded-2xl rounded-bl-sm px-4 py-2.5 border border-[var(--border)]">
              {selectedAgent && (
                <div className="flex items-center gap-1 mb-1 opacity-50">
                  <span className="text-[10px] font-medium">
                    {AGENTS.find(a => a.id === selectedAgent)?.emoji} {AGENTS.find(a => a.id === selectedAgent)?.name}
                  </span>
                </div>
              )}

              {/* Live thinking block while streaming */}
              {hasStreamingThinking && (
                <ThinkingBlock thinking={streamingThinking} isStreaming />
              )}

              {streamingContent ? (
                <div>
                  <MarkdownResponse content={streamingContent} />
                  <span className="inline-block w-[2px] h-[14px] bg-[var(--text-secondary)] opacity-60 animate-pulse ml-0.5 align-text-bottom" />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[11px] text-[var(--text-secondary)] font-light ml-1">
                    {hasStreamingThinking ? "Processing..." : "Thinking..."}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Queue indicator */}
        {messageQueueRef.current.length > 0 && isLoading && (
          <div className="flex justify-center">
            <span className="text-[10px] text-[var(--text-secondary)] opacity-50 font-light">
              {messageQueueRef.current.length} message(s) queued
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && !isLoading && (
        <div className="mb-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-500 font-light flex items-center gap-2">
          <span className="material-icons text-[14px]">warning</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="material-icons text-[14px] hover:opacity-70">close</button>
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 pt-3 border-t border-[var(--border)]">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={selectedAgent ? `Message ${AGENTS.find(a => a.id === selectedAgent)?.name || selectedAgent}...` : "Type a message..."}
          rows={1}
          className="flex-1 px-4 py-2.5 bg-[var(--surface)] rounded-2xl border border-[var(--border)] focus:outline-none focus:border-[var(--text-secondary)] resize-none text-[14px] font-light text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-50 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full bg-[var(--text-primary)] text-[var(--background)] flex items-center justify-center flex-shrink-0 disabled:opacity-20 transition-all active:scale-95"
        >
          <span className="material-icons text-[18px]">
            {isLoading ? "hourglass_empty" : "send"}
          </span>
        </button>
      </div>

      {/* Voice Mode Overlay */}
      {voiceModeOpen && (
        <VoiceMode onClose={() => setVoiceModeOpen(false)} />
      )}
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
