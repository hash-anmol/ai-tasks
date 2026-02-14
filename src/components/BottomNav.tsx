"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

export default function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  const navItems = [
    { href: "/", icon: "task_alt", label: "Tasks", active: pathname === "/" },
    { href: "/agents", icon: "smart_toy", label: "Agents", active: pathname === "/agents" },
    { href: "/activity", icon: "history", label: "Activity", active: pathname === "/activity" },
    { href: "/standup", icon: "assignment", label: "Standup", active: pathname === "/standup" },
    { href: "/notifications", icon: "notifications", label: "Alerts", active: pathname === "/notifications", badge: unreadCount },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-6 pt-3 pb-8 flex justify-between items-center z-40">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 relative ${
            item.active ? "text-primary" : "text-slate-400"
          }`}
        >
          <span className="material-icons text-lg">{item.icon}</span>
          <span className={`text-[9px] ${item.active ? "font-bold" : "font-medium"}`}>
            {item.label}
          </span>
          {item.badge && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
