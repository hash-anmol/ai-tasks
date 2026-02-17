"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TaskList from "@/components/TaskList";
import KanbanBoard from "@/components/KanbanBoard";
import Chat from "@/components/Chat";

import AppFooter from "@/components/AppFooter";
import VoiceMode from "@/components/VoiceMode";

import { ThemeToggle } from "@/components/ThemeToggle";

type MainTab = "chat" | "tasks";
type SubTab = "all" | "ai" | "archive";

function TabNavigation({ 
  mainTab, 
  setMainTab, 
  subTab, 
  setSubTab, 
  view, 
  setView 
}: { 
  mainTab: MainTab; 
  setMainTab: (t: MainTab) => void;
  subTab: SubTab;
  setSubTab: (t: SubTab) => void;
  view: string; 
  setView: (v: string) => void;
}) {
  const tabs: { id: MainTab; label: string }[] = [
    { id: "chat", label: "Chat" },
    { id: "tasks", label: "Tasks" },
  ];

  const subTabs: { id: SubTab; label: string }[] = [
    { id: "all", label: "All Tasks" },
    { id: "ai", label: "AI Tasks" },
    { id: "archive", label: "Archived" },
  ];

  return (
    <>
      {/* Top pill navigation */}
      <div className="flex items-center justify-between">
        <div className="absolute left-6">
          <ThemeToggle />
        </div>

        <div className="flex-1 flex justify-center">
          <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-full p-1 flex items-center shadow-sm">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMainTab(tab.id)}
                className={`px-6 py-2 rounded-full text-sm transition-all ${
                  mainTab === tab.id
                    ? "font-semibold text-[var(--background)] bg-[var(--text-primary)] shadow-md transform scale-105"
                    : "font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        
        {mainTab === "tasks" && (
          <button
            onClick={() => setView(view === "list" ? "kanban" : "list")}
            className="absolute right-6 w-9 h-9 flex items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all active:scale-95 shadow-sm"
            title={view === "list" ? "Kanban View" : "List View"}
          >
            <span className="material-symbols-outlined text-[20px]">
              {view === "list" ? "view_kanban" : "view_list"}
            </span>
          </button>
        )}
      </div>

      {/* Sub-tabs with dot indicator - only shown for Tasks tab */}
      {mainTab === "tasks" && (
        <div className="flex items-center justify-around w-full max-w-sm mx-auto mt-4">
          {subTabs.map((tab) => (
            <div 
              key={tab.id}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
              onClick={() => setSubTab(tab.id)}
            >
              <span className={`text-[13px] transition-colors ${
                subTab === tab.id
                  ? "font-semibold text-[var(--text-primary)]" 
                  : "font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>
                {tab.label}
              </span>
              <div className={`w-1 h-1 rounded-full transition-colors ${
                subTab === tab.id ? "bg-blue-500" : "bg-transparent"
              }`}></div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const [view, setView] = useState("list");
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  
  // Derive initial tab from URL params
  const tabParam = searchParams.get("tab");
  const getInitialMainTab = (): MainTab => {
    if (tabParam === "chat") return "chat";
    if (tabParam === "all" || tabParam === "ai" || tabParam === "archive") return "tasks";
    return "tasks"; // Default to tasks
  };
  
  const getInitialSubTab = (): SubTab => {
    if (tabParam === "ai") return "ai";
    if (tabParam === "archive") return "archive";
    return "all";
  };
  
  const [mainTab, setMainTab] = useState<MainTab>(getInitialMainTab);
  const [subTab, setSubTab] = useState<SubTab>(getInitialSubTab);
  const agentFilter = searchParams.get("agent") || "all";

  // Update URL when tabs change (without reload)
  const handleMainTabChange = (tab: MainTab) => {
    setMainTab(tab);
    if (tab === "tasks") {
      window.history.replaceState({}, "", `/?tab=${subTab}`);
    } else {
      window.history.replaceState({}, "", `/?tab=${tab}`);
    }
  };

  const handleSubTabChange = (tab: SubTab) => {
    setSubTab(tab);
    window.history.replaceState({}, "", `/?tab=${tab}`);
  };

  const handleChatClick = () => {
    handleMainTabChange("chat");
  };

  const handleVoiceClick = () => {
    setVoiceModeOpen(true);
  };

  return (
    <div className="h-screen overflow-hidden relative flex flex-col bg-[var(--background)]">
      {/* Header */}
      <header className="pt-12 pb-2 px-6 flex flex-col gap-6 z-10 bg-[var(--background)]/80 backdrop-blur-sm">
        <TabNavigation 
          mainTab={mainTab} 
          setMainTab={handleMainTabChange}
          subTab={subTab}
          setSubTab={handleSubTabChange}
          view={view} 
          setView={setView} 
        />
      </header>

      {/* Main scrollable content */}
      <main className={`flex-1 overflow-y-auto hide-scrollbar px-6 pb-32 pt-4 ${
        mainTab === "chat" ? "flex flex-col" : ""
      }`}>
        {mainTab === "chat" && <Chat />}
        {mainTab === "tasks" && (
          view === "kanban" ? (
            <KanbanBoard />
          ) : (
            <TaskList agentFilter={agentFilter} activeTab={subTab} onChatClick={handleChatClick} />
          )
        )}
      </main>

      {!voiceModeOpen && (
        <AppFooter onChatClick={handleChatClick} onVoiceClick={handleVoiceClick} />
      )}

      {/* Voice Mode Overlay */}
      {voiceModeOpen && (
        <VoiceMode onClose={() => setVoiceModeOpen(false)} />
      )}

      {/* Ambient background gradients */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] ambient-gradient-blue rounded-full blur-3xl opacity-20 dark:opacity-10"></div>
        <div className="absolute top-[40%] -left-[10%] w-[300px] h-[300px] ambient-gradient-rose rounded-full blur-3xl opacity-20 dark:opacity-10"></div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-[var(--background)] flex items-center justify-center">
        <p className="text-[var(--text-secondary)] text-sm font-light opacity-50">Loading...</p>
      </div>
    }>
      <PageContent />
    </Suspense>
  );
}
