"use client";

import { useState, useEffect, useCallback } from "react";

interface MemoryState {
  currentTask: string | null;
  status: "idle" | "working" | "reviewing" | "blocked";
  agent: string | null;
  context: string;
  blockers: string[];
  nextSteps: string[];
}

const MEMORY_KEY = "ai-tasks-memory";
const WORKING_KEY = "ai-tasks-working";

export function useMemory() {
  const [workingMemory, setWorkingMemory] = useState<MemoryState>({
    currentTask: null,
    status: "idle",
    agent: null,
    context: "",
    blockers: [],
    nextSteps: [],
  });

  // Load working memory from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(WORKING_KEY);
    if (stored) {
      setWorkingMemory(JSON.parse(stored));
    }
  }, []);

  // Save working memory whenever it changes
  const saveWorkingMemory = useCallback((memory: MemoryState) => {
    setWorkingMemory(memory);
    localStorage.setItem(WORKING_KEY, JSON.stringify(memory));
  }, []);

  // Update current task
  const setCurrentTask = useCallback((task: string | null) => {
    setWorkingMemory(prev => {
      const updated = { ...prev, currentTask: task };
      localStorage.setItem(WORKING_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Update status
  const setStatus = useCallback((status: MemoryState["status"]) => {
    setWorkingMemory(prev => {
      const updated = { ...prev, status };
      localStorage.setItem(WORKING_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Add blocker
  const addBlocker = useCallback((blocker: string) => {
    setWorkingMemory(prev => {
      const updated = { ...prev, blockers: [...prev.blockers, blocker] };
      localStorage.setItem(WORKING_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear blocker
  const clearBlocker = useCallback((index: number) => {
    setWorkingMemory(prev => {
      const blockers = [...prev.blockers];
      blockers.splice(index, 1);
      const updated = { ...prev, blockers };
      localStorage.setItem(WORKING_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Add next step
  const addNextStep = useCallback((step: string) => {
    setWorkingMemory(prev => {
      const updated = { ...prev, nextSteps: [...prev.nextSteps, step] };
      localStorage.setItem(WORKING_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear completed steps
  const clearNextSteps = useCallback(() => {
    setWorkingMemory(prev => {
      const updated = { ...prev, nextSteps: [] };
      localStorage.setItem(WORKING_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return {
    workingMemory,
    setCurrentTask,
    setStatus,
    addBlocker,
    clearBlocker,
    addNextStep,
    clearNextSteps,
    saveWorkingMemory,
  };
}

// Helper to get today's date file name
export function getTodayFileName(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
