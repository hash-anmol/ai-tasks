"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import VoiceMode from "./VoiceMode";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  createdTasks?: { title: string; agent?: string }[];
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

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegationMode, setDelegationMode] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageQueueRef = useRef<string[]>([]);

  // Convex mutation for creating tasks
  const createTask = useMutation(api.tasks.createTask);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to send message (${res.status})`);
      }

      const data = await res.json();

      if (data.content) {
        // Parse task creation blocks
        const taskDefs = parseTaskBlocks(data.content);
        const displayContent = stripTaskBlocks(data.content);
        let createdTasks: { title: string; agent?: string }[] = [];

        // Actually create the tasks in Convex
        if (taskDefs.length > 0) {
          createdTasks = await handleTaskCreation(taskDefs);
        }

        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: displayContent || (createdTasks.length > 0 ? `Created ${createdTasks.length} task(s).` : data.content),
          timestamp: Date.now(),
          createdTasks: createdTasks.length > 0 ? createdTasks : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        setConnected(true);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: `Error: ${err.message || "Could not reach AI agent. Is OpenCode running?"}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);

      // Process queued messages
      if (messageQueueRef.current.length > 0) {
        const nextMsg = messageQueueRef.current.shift()!;
        // Use setTimeout to allow state to settle
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
      // Show queued indicator
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
    messageQueueRef.current = [];
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header with controls */}
      <div className="flex items-center justify-between mb-3">
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

      {/* Delegation mode toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] mb-3">
        <div className="flex items-center gap-2">
          <span className="material-icons text-[14px] text-[var(--text-secondary)]">account_tree</span>
          <span className="text-[12px] text-[var(--text-primary)] font-medium">Delegation Mode</span>
        </div>
        <button
          onClick={() => setDelegationMode(!delegationMode)}
          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
            delegationMode ? "bg-blue-500" : "bg-[var(--border)]"
          }`}
        >
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
            delegationMode ? "translate-x-[18px]" : "translate-x-0.5"
          }`} />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto hide-scrollbar space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-icons text-4xl text-[var(--border)] mb-3 opacity-50">auto_awesome</span>
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
              {msg.role === "assistant" && !msg.id.startsWith("error-") && (
                <div className="flex items-center gap-1 mb-1 opacity-50">
                  <span className="material-icons text-[11px]">smart_toy</span>
                  <span className="text-[10px] font-medium">AI</span>
                </div>
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
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[var(--surface)] rounded-2xl rounded-bl-sm px-4 py-3 border border-[var(--border)]">
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-[var(--text-secondary)] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-[11px] text-[var(--text-secondary)] font-light ml-1">Thinking...</span>
              </div>
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
          placeholder="Type a message..."
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
