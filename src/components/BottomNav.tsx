"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { href: "/", icon: "task_alt", label: "Tasks", active: pathname === "/" },
    { href: "/calendar", icon: "calendar_today", label: "Calendar", active: pathname === "/calendar" },
    { href: "/projects", icon: "folder_open", label: "Projects", active: pathname === "/projects" },
    { href: "/settings", icon: "settings", label: "Settings", active: pathname === "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-200 px-8 pt-3 pb-8 flex justify-between items-center z-40">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-col items-center gap-1 ${
            item.active ? "text-primary" : "text-slate-400"
          }`}
        >
          <span className="material-icons">{item.icon}</span>
          <span className={`text-[10px] ${item.active ? "font-bold" : "font-medium"}`}>
            {item.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
