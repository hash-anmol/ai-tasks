"use client";

import { useGamification, XP_PER_LEVEL } from "@/hooks/useGamification";

export default function GamificationHeader() {
  const { stats, getXPProgress, loaded } = useGamification();

  if (!loaded) return null;

  const xpProgress = getXPProgress();

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-2">
      <div className="flex items-center justify-between">
        {/* Coins */}
        <div className="flex items-center gap-1.5">
          <span className="text-xl">🪙</span>
          <span className="font-bold text-slate-800">{stats.coins}</span>
        </div>

        {/* Streak */}
        <div className="flex items-center gap-1.5">
          <span className={`text-xl ${stats.streak > 0 ? "animate-flame" : ""}`}>
            {stats.streak >= 7 ? "🔥" : stats.streak > 0 ? "💪" : "❄️"}
          </span>
          <span className="font-bold text-slate-800">{stats.streak}</span>
          <span className="text-xs text-slate-500">day{stats.streak !== 1 ? "s" : ""}</span>
        </div>

        {/* Level */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10">
            {/* XP Progress Ring */}
            <svg className="w-10 h-10 -rotate-90">
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="#e2e8f0"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="20"
                cy="20"
                r="16"
                stroke="#13ec5b"
                strokeWidth="3"
                fill="none"
                strokeDasharray={`${xpProgress * 100} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-800">Lv.{stats.level}</span>
            </div>
          </div>
        </div>
      </div>

      {/* XP Bar */}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>XP</span>
          <span>{stats.xp % XP_PER_LEVEL} / {XP_PER_LEVEL}</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
