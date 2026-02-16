"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import VoiceMode from "./VoiceMode";

const AGENTS = [
  { id: "researcher", name: "Researcher", emoji: "🔍" },
  { id: "writer", name: "Writer", emoji: "✍️" },
  { id: "editor", name: "Editor", emoji: "📝" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯" },
];

interface Session {
  _id: string;
  sessionId: string;
  name: string;
  agent: string;
  status: string;
  taskCount: number;
  lastTaskTitle?: string;
  updatedAt: number;
}

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

// System prompt that teaches the AI how to create tasks
const TASK_CREATION_SYSTEM_PROMPT = `You are an AI assistant integrated into a task management app. You can create tasks for the user.

When the user asks you to create a task, add a todo, or anything that implies creating an actionable item, you MUST include a JSON block in your response using this exact format:

[CREATE_TASK]
{"title": "Task title here", "description": "Optional description", "priority": "medium", "agent": "researcher", "tags": ["tag1"]}
[/CREATE_TASK]

Rules for task creation:
- "title" is required (string)
- "description" is optional (string)
- "priority" can be "low", "medium", or "high" (defaults to "medium")
- "agent" can be "researcher", "writer", "editor", or "coordinator" (optional - only set if the task is an AI task)
- "tags" is an optional array of strings
- You can create multiple tasks by including multiple [CREATE_TASK]...[/CREATE_TASK] blocks
- Always confirm to the user what tasks you created
- If the user's request is ambiguous, ask for clarification before creating tasks

Important: You MUST wrap the JSON in [CREATE_TASK] and [/CREATE_TASK] markers. Do NOT just describe creating a task - actually include the markers so the system can create it.`;

const DELEGATION_SYSTEM_PROMPT = `You are a coordinator AI agent. When the user asks you to do something, break it into subtasks and delegate them to specialized agents (researcher, writer, editor). 

When creating delegated tasks, use [CREATE_TASK]...[/CREATE_TASK] blocks with the appropriate "agent" field:
- "researcher" for information gathering, research, analysis
- "writer" for content creation, drafting, writing
- "editor" for reviewing, proofreading, refinement

[CREATE_TASK]
{"title": "Task title", "description": "Description", "priority": "medium", "agent": "researcher", "tags": ["delegated"]}
[/CREATE_TASK]

Explain your delegation plan and create the tasks.`;

// Parse [CREATE_TASK]...[/CREATE_TASK] blocks from AI response
function parseTaskBlocks(content: string): { title: string; description?: string; priority?: string; agent?: string; tags?: string[] }[] {
  const tasks: { title: string; description?: string; priority?: string; agent?: string; tags?: string[] }[] = [];
  const regex = /\[CREATE_TASK\]\s*([\s\S]*?)\s*\[\/CREATE_TASK\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.title && typeof parsed.title === "string") {
        tasks.push({
          title: parsed.title,
          description: parsed.description,
          priority: parsed.priority || "medium",
          agent: parsed.agent,
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
        });
      }
    } catch {
      // Skip malformed JSON
    }
  }

  return tasks;
}

// Strip [CREATE_TASK] blocks from displayed message
function stripTaskBlocks(content: string): string {
  return content.replace(/\[CREATE_TASK\]\s*[\s\S]*?\s*\[\/CREATE_TASK\]/g, "").trim();
}

// File attachment types we support
interface FileAttachment {
  url: string;
  filename: string;
  type: "pdf" | "image" | "document" | "other";
}

// Parse file URLs from content
function parseFileAttachments(content: string): FileAttachment[] {
  const attachments: FileAttachment[] = [];
  const urlRegex = /(https?:\/\/[^\s<>"\]]+\.(pdf|png|jpg|jpeg|gif|webp|doc|docx|xls|xlsx|ppt|pptx|txt|zip|mp3|mp4|mov|avi))/gi;
  const matches = content.match(urlRegex);
  
  if (matches) {
    for (const url of matches) {
      const ext = url.split(".").pop()?.toLowerCase() || "";
      let type: FileAttachment["type"] = "other";
      
      if (["pdf"].includes(ext)) type = "pdf";
      else if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) type = "image";
      else if (["doc", "docx", "txt"].includes(ext)) type = "document";
      else if (["xls", "xlsx", "ppt", "pptx"].includes(ext)) type = "document";
      
      const filename = url.split("/").pop()?.split("?")[0] || "file";
      attachments.push({ url, filename, type });
    }
  }
  
  return attachments;
}

// Get icon for file type
function getFileIcon(type: FileAttachment["type"]): string {
  switch (type) {
    case "pdf": return "picture_as_pdf";
    case "image": return "image";
    case "document": return "description";
    default: return "attach_file";
  }
}

// FileAttachmentBlock component
function FileAttachmentBlock({ attachments }: { attachments: FileAttachment[] }) {
  if (attachments.length === 0) return null;
  
  return (
    <div className="mt-2 pt-2 border-t border-[var(--border)]/30 space-y-1.5">
      <p className="text-[10px] text-[var(--text-secondary)] opacity-60 font-medium uppercase tracking-wide">
        Attachments ({attachments.length})
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((file, i) => (
          <a
            key={i}
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <span className="material-icons text-[14px] text-blue-500">{getFileIcon(file.type)}</span>
            <span className="text-[11px] text-[var(--text-primary)] font-light max-w-[120px] truncate">
              {file.filename}
            </span>
            <span className="material-icons text-[12px] text-[var(--text-secondary)] opacity-0 group-hover:opacity-60 transition-opacity">
              download
            </span>
          </a>
        ))}
      </div>
    </div>
  );
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
  const [delegationMode, setDelegationMode] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingThinking, setStreamingThinking] = useState<ThinkingData>({
    thinkingText: "",
    toolCalls: [],
  });
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(undefined);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("new");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageQueueRef = useRef<string[]>([]);

  // Convex mutation for creating tasks
  const createTask = useMutation(api.tasks.createTask);

  // Convex query for sessions (filtered by selected agent)
  const allSessions = (useQuery(api.sessions.getSessions) || []) as Session[];
  const agentSessions = selectedAgent
    ? allSessions
        .filter((s) => s.agent === selectedAgent)
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

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

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Create tasks from parsed AI response and fire-and-forget to execute endpoint
  const handleTaskCreation = async (taskDefs: { title: string; description?: string; priority?: string; agent?: string; tags?: string[] }[]) => {
    const created: { title: string; agent?: string }[] = [];

    for (const def of taskDefs) {
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
        });

        created.push({ title: def.title, agent: def.agent });

        // Fire-and-forget: send AI tasks to OpenClaw for execution
        if (isAI && taskId) {
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
      const systemPrompt = delegationMode
        ? DELEGATION_SYSTEM_PROMPT
        : TASK_CREATION_SYSTEM_PROMPT;

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
          sessionId: selectedSessionId !== "new" ? selectedSessionId : undefined,
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

      {/* Chat header row 2: Agent selector + Session selector + Delegation toggle */}
      <div className="flex items-center gap-2 mb-3">
        {/* Agent selector */}
        <select
          value={selectedAgent || ""}
          onChange={(e) => handleAgentChange(e.target.value || undefined)}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] focus:border-blue-500 focus:outline-none text-[12px] font-medium text-[var(--text-primary)] truncate"
        >
          <option value="">Default Agent</option>
          {AGENTS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>

        {/* Session selector - only when an agent is chosen */}
        {selectedAgent && (
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] focus:border-blue-500 focus:outline-none text-[12px] font-light text-[var(--text-primary)] truncate"
          >
            <option value="new">+ New Session</option>
            {agentSessions.map((session) => {
              const timeAgo = getTimeAgo(session.updatedAt);
              const statusIcon = session.status === "active" ? "\u25CF" : session.status === "completed" ? "\u2713" : "\u2715";
              return (
                <option key={session.sessionId} value={session.sessionId}>
                  {statusIcon} {session.name} ({session.taskCount} task{session.taskCount !== 1 ? "s" : ""}, {timeAgo})
                </option>
              );
            })}
          </select>
        )}

        {/* Delegation toggle - compact */}
        <button
          onClick={() => setDelegationMode(!delegationMode)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-[12px] font-medium flex-shrink-0 ${
            delegationMode
              ? "border-blue-500 bg-blue-500/10 text-blue-500"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          }`}
          title="Delegation Mode - Break tasks into subtasks for specialized agents"
        >
          <span className="material-icons text-[14px]">account_tree</span>
          <span className="hidden sm:inline">Delegate</span>
        </button>
      </div>

      {/* Session context hint */}
      {selectedAgent && selectedSessionId !== "new" && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 mb-2 text-[11px] text-blue-500 bg-blue-500/5 rounded-lg border border-blue-500/10">
          <span className="material-icons text-[12px]">history</span>
          <span className="font-light">Continuing in existing session — agent retains prior context</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3 pb-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons text-4xl text-[var(--border)] mb-3 opacity-30">chat</span>
            <p className="text-[var(--text-primary)] text-sm font-light mb-1 opacity-80">Chat with your AI agent</p>
            <p className="text-[var(--text-secondary)] text-xs font-light max-w-[260px] opacity-50 leading-relaxed">
              Ask questions, get help with tasks, or have the agent create and manage tasks for you.
            </p>
            {connected === false && (
              <div className="mt-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-500">
                OpenClaw not reachable. Check that the server is running.
              </div>
            )}
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

              <pre className="text-[13px] font-body whitespace-pre-wrap leading-relaxed font-light">
                {msg.content}
              </pre>

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
                <pre className="text-[13px] font-body whitespace-pre-wrap leading-relaxed font-light">
                  {streamingContent}
                  <span className="inline-block w-[2px] h-[14px] bg-[var(--text-secondary)] opacity-60 animate-pulse ml-0.5 align-text-bottom" />
                </pre>
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
