import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TaskList from "@/components/TaskList";
import AddTaskButton from "@/components/AddTaskButton";
import GamificationHeader from "@/components/GamificationHeader";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Tasks - Task Manager",
  description: "Task manager with AI agent integration",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background-light">
      {/* iOS Status Bar Spacer */}
      <div className="h-12 w-full bg-white sticky top-0 z-50"></div>
      
      {/* Gamification Stats Header */}
      <GamificationHeader />
      
      {/* Header & Navigation */}
      <header className="bg-white border-b border-primary/10 sticky top-12 z-40">
        <div className="px-6 pt-4 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">Today</h1>
          <p className="text-sm text-slate-500 mt-1">4 of 7 tasks completed</p>
        </div>
        
        {/* Horizontal Scrollable Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar px-6 space-x-6 mt-4">
          <a className="pb-3 border-b-2 border-primary text-primary font-semibold whitespace-nowrap text-sm" href="#">Today</a>
          <a className="pb-3 border-b-2 border-transparent text-slate-400 font-medium whitespace-nowrap text-sm" href="#">Inbox</a>
          <a className="pb-3 border-b-2 border-transparent text-slate-400 font-medium whitespace-nowrap text-sm" href="#">AI Tasks</a>
          <a className="pb-3 border-b-2 border-transparent text-slate-400 font-medium whitespace-nowrap text-sm" href="#">Archive</a>
        </div>
      </header>
      
      {/* Task List Content */}
      <main className="px-5 py-6 space-y-4 pb-32">
        <TaskList />
      </main>
      
      {/* Bottom Navigation Bar */}
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
      
      {/* Floating Action Button */}
      <AddTaskButton />
      
      {/* Material Icons */}
      <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
    </div>
  );
}
