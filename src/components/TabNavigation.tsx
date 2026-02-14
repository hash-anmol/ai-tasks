"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Tab = "today" | "inbox" | "ai" | "archive";

const tabs: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "inbox", label: "Inbox" },
  { id: "ai", label: "AI Tasks" },
  { id: "archive", label: "Archive" },
];

export default function TabNavigation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>("today");

  useEffect(() => {
    const tab = searchParams.get("tab") as Tab;
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabClick = (tabId: Tab) => {
    setActiveTab(tabId);
    // Update URL without refresh
    const url = tabId === "today" ? "/" : `/?tab=${tabId}`;
    router.push(url);
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
