"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

interface MenuProps {
  onChatClick?: () => void;
  onVoiceClick?: () => void;
}

export default function Menu({ onChatClick, onVoiceClick }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { unreadCount } = useNotifications();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const handleChatClick = () => {
    setIsOpen(false);
    onChatClick?.();
  };

  const handleVoiceClick = () => {
    setIsOpen(false);
    onVoiceClick?.();
  };

  const menuItems = [
    { href: "/", icon: "task_alt", label: "Tasks", active: pathname === "/" },
    { href: "/agents", icon: "smart_toy", label: "Agents", active: pathname === "/agents" },
    { href: "/ai-work", icon: "auto_awesome", label: "AI Work", active: pathname === "/ai-work" },
    { href: "/notifications", icon: "notifications", label: "Alerts", active: pathname === "/notifications", badge: unreadCount },
  ];

  const specialItems = [
    { icon: "chat", label: "Chat", onClick: handleChatClick },
    { icon: "mic", label: "Voice Mode", onClick: handleVoiceClick },
  ];

  return (
    <div ref={menuRef} className="fixed bottom-6 right-6 z-50 voice-mode-hide">
      {/* Menu Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 mb-2 w-56 bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          {/* Main Navigation Items */}
          <div className="p-2">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  item.active
                    ? "bg-[var(--text-primary)]/10 text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/50"
                }`}
              >
                <span className="material-icons text-[20px]">{item.icon}</span>
                <span className="text-sm font-medium flex-1">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge > 9 ? "9+" : item.badge}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-[var(--border)] mx-2" />

          {/* Special Items (Chat & Voice) */}
          <div className="p-2">
            {specialItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]/50"
              >
                <span className="material-icons text-[20px]">{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          isOpen
            ? "bg-[var(--text-primary)] text-[var(--background)] rotate-90"
            : "bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--border)]"
        }`}
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        <span className="material-icons text-[24px]">
          {isOpen ? "close" : "menu"}
        </span>
      </button>
    </div>
  );
}
