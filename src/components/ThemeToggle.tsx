"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)]">
        <div className="w-5 h-5" />
      </div>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-9 h-9 flex items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--border)] transition-all active:scale-95 shadow-sm"
      title="Toggle dark mode"
    >
      {theme === "dark" ? (
        <Sun className="h-[18px] w-[18px] transition-all" />
      ) : (
        <Moon className="h-[18px] w-[18px] transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}
