"use client";

import { useGamification, ACHIEVEMENTS } from "@/hooks/useGamification";

export default function AchievementsPage() {
  const { stats, loaded } = useGamification();

  if (!loaded) return null;

  const allAchievements = Object.entries(ACHIEVEMENTS).map(([key, value]) => ({
    id: key,
    ...value,
    unlocked: stats.achievements.includes(key),
  }));

  return (
    <div className="min-h-screen bg-background-light p-5">
      <h1 className="text-2xl font-bold mb-2">Achievements</h1>
      <p className="text-sm text-slate-500 mb-6">
        {stats.achievements.length} / {allAchievements.length} unlocked
      </p>

      <div className="grid grid-cols-2 gap-4">
        {allAchievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-4 rounded-xl border-2 ${
              achievement.unlocked
                ? "bg-white border-primary shadow-lg"
                : "bg-slate-50 border-slate-200 opacity-50"
            }`}
          >
            <div className="text-3xl mb-2">{achievement.icon}</div>
            <h3 className="font-bold text-sm">{achievement.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{achievement.desc}</p>
            {achievement.unlocked && (
              <div className="mt-2 text-xs font-bold text-primary">✓ Unlocked</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
