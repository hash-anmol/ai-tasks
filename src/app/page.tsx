"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TaskList from "@/components/TaskList";
import AddTaskButton from "@/components/AddTaskButton";
import GamificationHeader from "@/components/GamificationHeader";

function TabNavigation() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("today");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
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

  return (
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
  );
}

function PageContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "today";

  return (
    <div className="min-h-screen bg-background-light">
      <div className="h-12 w-full bg-white sticky top-0 z-50"></div>
      <GamificationHeader />
      <header className="bg-white border-b border-primary/10 sticky top-12 z-40">
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {activeTab === "ai" ? "AI Tasks" : activeTab === "inbox" ? "Inbox" : activeTab === "archive" ? "Archive" : "Today"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your tasks</p>
        </div>
        <TabNavigation />
      </header>
      <main className="px-5 py-6 space-y-4 pb-32">
        <TaskList />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-8 pt-3 pb-8 flex justify-between items-center z-40">
        <button className="flex flex-col items-center gap-1 text-primary">
          <span className="material-icons">task_alt</span>
          <span className="text-[10px] font-bold">Tasks</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-icons">calendar_today</span>
          <span className="text-[10px] font-medium">Calendar</span>
        </button>
        <div className="w-12"></div>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-icons">folder_open</span>
          <span className="text-[10px] font-medium">Projects</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <span className="material-icons">settings</span>
          <span className="text-[10px] font-medium">Settings</span>
        </button>
      </nav>
      <AddTaskButton />
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
