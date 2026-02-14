"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TaskList from "@/components/TaskList";
import KanbanBoard from "@/components/KanbanBoard";
import AddTaskButton from "@/components/AddTaskButton";
import GamificationHeader from "@/components/GamificationHeader";
import BottomNav from "@/components/BottomNav";

const AGENTS = [
  { id: "all", name: "All", emoji: "🌟" },
  { id: "researcher", name: "Researcher", emoji: "🔍" },
  { id: "writer", name: "Writer", emoji: "✍️" },
  { id: "editor", name: "Editor", emoji: "📝" },
  { id: "coordinator", name: "Coordinator", emoji: "🎯" },
];

function TabNavigation({ view, setView }: { view: string; setView: (v: string) => void }) {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("today");
  const [agentFilter, setAgentFilter] = useState("all");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
    const agent = searchParams.get("agent");
    if (agent) setAgentFilter(agent);
  }, [searchParams]);

  const tabs = [
    { id: "today", label: "Today" },
    { id: "inbox", label: "Inbox" },
    { id: "ai", label: "AI Tasks" },
    { id: "archive", label: "Archive" },
  ];

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    window.history.pushState({}, "", tabId === "today" ? "/" : `/?tab=${tabId}`);
    window.location.reload();
  };

  const handleAgentFilter = (agentId: string) => {
    setAgentFilter(agentId);
    const url = new URL(window.location.href);
    if (agentId === "all") {
      url.searchParams.delete("agent");
    } else {
      url.searchParams.set("agent", agentId);
    }
    window.history.pushState({}, "", url);
    window.location.reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex overflow-x-auto hide-scrollbar px-6 space-x-6 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`pb-3 border-b-2 whitespace-nowrap text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 px-4">
          <button
            onClick={() => setView("list")}
            className={`p-2 rounded-lg ${view === "list" ? "bg-primary text-slate-900" : "text-slate-400"}`}
            title="List View"
          >
            <span className="material-icons text-sm">view_list</span>
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`p-2 rounded-lg ${view === "kanban" ? "bg-primary text-slate-900" : "text-slate-400"}`}
            title="Kanban View"
          >
            <span className="material-icons text-sm">view_kanban</span>
          </button>
        </div>
      </div>
      
      {/* Agent Filter */}
      <div className="px-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {AGENTS.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleAgentFilter(agent.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1 transition-colors ${
                agentFilter === agent.id
                  ? "bg-primary text-slate-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {agent.emoji} {agent.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "today";
  const agentFilter = searchParams.get("agent") || "all";
  const [view, setView] = useState("list");

  const getTitle = () => {
    if (agentFilter !== "all") {
      const agent = AGENTS.find(a => a.id === agentFilter);
      return `${agent?.emoji} ${agent?.name}'s Tasks`;
    }
    switch (activeTab) {
      case "ai": return "AI Tasks";
      case "inbox": return "Inbox";
      case "archive": return "Archive";
      default: return "Today";
    }
  };

  return (
    <div className="min-h-screen bg-background-light">
      <div className="h-12 w-full bg-white sticky top-0 z-50"></div>
      <GamificationHeader />
      <header className="bg-white border-b border-primary/10 sticky top-12 z-40">
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">{getTitle()}</h1>
          <p className="text-sm text-slate-500 mt-1">Your tasks</p>
        </div>
        <TabNavigation view={view} setView={setView} />
      </header>
      <main className="px-5 py-6 space-y-4 pb-32">
        {view === "kanban" ? (
          <KanbanBoard />
        ) : (
          <TaskList agentFilter={agentFilter} />
        )}
      </main>
      <AddTaskButton />
      <BottomNav />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background-light flex items-center justify-center">Loading...</div>}>
      <PageContent />
    </Suspense>
  );
}
