"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

export default function BottomNav() {
  const pathname = usePathname();
  const { unreadCount } = useNotifications();

  const navItems = [
    { href: "/", icon: "task_alt", label: "Tasks", active: pathname === "/" },
    { href: "/calendar", icon: "calendar_today", label: "Calendar", active: pathname === "/calendar" },
    { href: "/notifications", icon: "notifications", label: "Alerts", active: pathname === "/notifications", badge: unreadCount },
    { href: "/settings", icon: "settings", label: "Settings", active: pathname === "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-8 pt-3 pb-8 flex justify-between items-center z-40">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 relative ${
            item.active ? "text-primary" : "text-slate-400"
          }`}
        >
          <span className="material-icons">{item.icon}</span>
          <span className={`text-[10px] ${item.active ? "font-bold" : "font-medium"}`}>
            {item.label}
          </span>
          {item.badge && item.badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {item.badge > 9 ? "9+" : item.badge}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
