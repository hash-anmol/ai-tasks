"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TaskList from "@/components/TaskList";
import AddTaskButton from "@/components/AddTaskButton";
import GamificationHeader from "@/components/GamificationHeader";
import BottomNav from "@/components/BottomNav";

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

  const getTitle = () => {
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
        <TabNavigation />
      </header>
      <main className="px-5 py-6 space-y-4 pb-32">
        <TaskList />
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
