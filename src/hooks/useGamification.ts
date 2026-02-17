"use client";

import { useState, useEffect } from "react";

interface UserStats {
  coins: number;
  streak: number;
  xp: number;
  level: number;
  tasksCompleted: number;
  achievements: string[];
  lastCompletedDate: string | null;
}

const INITIAL_STATS: UserStats = {
  coins: 0,
  streak: 0,
  xp: 0,
  level: 1,
  tasksCompleted: 0,
  achievements: [],
  lastCompletedDate: null,
};

export const XP_PER_LEVEL = 100;
export const COINS_PER_TASK = 10;
export const XP_PER_TASK = 15;

export function useGamification() {
  const [stats, setStats] = useState<UserStats>(INITIAL_STATS);
  const [loaded, setLoaded] = useState(false);

  // Load stats from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ai-tasks-gamification");
    if (saved) {
      try {
        setStats(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse gamification stats", e);
      }
    }
    setLoaded(true);
  }, []);

  // Save to localStorage whenever stats change
  useEffect(() => {
    if (loaded) {
      localStorage.setItem("ai-tasks-gamification", JSON.stringify(stats));
    }
  }, [stats, loaded]);

  // Check and update streak
  const checkStreak = () => {
    const today = new Date().toDateString();
    const lastCompleted = stats.lastCompletedDate;

    if (lastCompleted) {
      const lastDate = new Date(lastCompleted);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate.toDateString() === yesterday.toDateString()) {
        // Streak continues - do nothing, just update date when completing
      } else if (lastDate.toDateString() !== today) {
        // Streak broken
        if (stats.lastCompletedDate) {
          setStats((s) => ({ ...s, streak: 0 }));
        }
      }
    }
  };

  const completeTask = () => {
    const today = new Date().toDateString();
    const lastCompleted = stats.lastCompletedDate;

    let newStreak = stats.streak;
    let newAchievements = [...stats.achievements];

    // Calculate streak
    if (lastCompleted) {
      const lastDate = new Date(lastCompleted);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      if (lastDate.toDateString() === yesterday.toDateString()) {
        newStreak += 1;
      } else if (lastDate.toDateString() !== today) {
        newStreak = 1;
      }
    } else {
      newStreak = 1;
    }

    // Calculate new XP and level
    const newXP = stats.xp + XP_PER_TASK;
    const newLevel = Math.floor(newXP / XP_PER_LEVEL) + 1;

    // Add coins
    const newCoins = stats.coins + COINS_PER_TASK;

    // Check achievements
    const totalTasks = stats.tasksCompleted + 1;
    if (totalTasks === 1 && !newAchievements.includes("first_task")) {
      newAchievements.push("first_task");
    }
    if (newStreak >= 7 && !newAchievements.includes("week_warrior")) {
      newAchievements.push("week_warrior");
    }
    if (totalTasks >= 100 && !newAchievements.includes("century")) {
      newAchievements.push("century");
    }
    if (newLevel >= 10 && !newAchievements.includes("level_10")) {
      newAchievements.push("level_10");
    }

    setStats({
      coins: newCoins,
      streak: newStreak,
      xp: newXP,
      level: newLevel,
      tasksCompleted: totalTasks,
      achievements: newAchievements,
      lastCompletedDate: today,
    });

    return {
      coinsEarned: COINS_PER_TASK,
      xpEarned: XP_PER_TASK,
      newLevel: newLevel > stats.level,
      newAchievements: newAchievements.filter((a) => !stats.achievements.includes(a)),
    };
  };

  const getXPProgress = () => {
    return (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
  };

  return {
    stats,
    completeTask,
    getXPProgress,
    loaded,
  };
}

export const ACHIEVEMENTS = {
  first_task: { name: "First Step", desc: "Complete your first task", icon: "🌟" },
  week_warrior: { name: "Week Warrior", desc: "7-day streak", icon: "🔥" },
  century: { name: "Century", desc: "Complete 100 tasks", icon: "💯" },
  level_10: { name: "Rising Star", desc: "Reach level 10", icon: "⭐" },
  early_bird: { name: "Early Bird", desc: "Complete task before 9 AM", icon: "🐦" },
};
