"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

export default function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  const leftItems = [
    { href: "/", icon: "task_alt", label: "Tasks", active: pathname === "/" },
    { href: "/agents", icon: "smart_toy", label: "Agents", active: pathname === "/agents" },
  ];

  const rightItems = [
    { href: "/ai-work", icon: "auto_awesome", label: "AI Work", active: pathname === "/ai-work" },
    { href: "/notifications", icon: "notifications", label: "Alerts", active: pathname === "/notifications", badge: unreadCount },
  ];

  return (
    <div className="fixed bottom-0 left-0 w-full z-40">
      <div className="relative h-20 w-full max-w-2xl mx-auto">
        {/* Shadow layer with cutout */}
        <div className="absolute top-0 left-0 w-full h-full shadow-[0_-5px_20px_rgba(0,0,0,0.03)] footer-cutout pointer-events-none"></div>
        
        {/* Nav bar with cutout */}
        <div className="w-full h-full bg-[var(--surface)]/95 backdrop-blur-md footer-cutout border-t border-[var(--border)] flex items-center justify-between px-6 sm:px-10 pb-2">
          {/* Left nav items */}
          <div className="flex items-center gap-2 sm:gap-4">
            {leftItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[48px] ${
                  item.active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-icons text-[20px]">{item.icon}</span>
                <span className={`text-[9px] ${item.active ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Center spacer for FAB */}
          <div className="w-16 flex-shrink-0"></div>

          {/* Right nav items */}
          <div className="flex items-center gap-2 sm:gap-4">
            {rightItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors relative min-w-[48px] ${
                  item.active ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="material-icons text-[20px]">{item.icon}</span>
                <span className={`text-[9px] ${item.active ? "font-semibold" : "font-medium"}`}>
                  {item.label}
                </span>
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-0.5 right-0 bg-red-500 text-white text-[7px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
