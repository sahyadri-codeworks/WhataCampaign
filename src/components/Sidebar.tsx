"use client";

import {
  BarChart3,
  Megaphone,
  GitBranch,
  Database,
  Plug,
  MessageSquare,
  ChevronLeft,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Journey Builder", href: "/journey", icon: GitBranch },
  { label: "Database", href: "/database", icon: Database },
  { label: "Connectors", href: "/connectors", icon: Plug },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-white/95 backdrop-blur-sm">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-purple-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={18} />
              {label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border bg-white min-h-screen transition-all duration-200 ${
          collapsed ? "w-[68px]" : "w-[220px]"
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-600 text-white shadow-sm">
            <MessageSquare size={18} />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-foreground truncate">WhataCampaign</p>
              <p className="text-[10px] text-muted-foreground">WhatsApp Platform</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                title={collapsed ? label : undefined}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-foreground/70 hover:bg-purple-50 hover:text-purple-700"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-border">
          {!collapsed ? (
            <div className="rounded-lg bg-purple-50 border border-purple-100 p-3">
              <p className="text-[11px] font-semibold text-purple-700">Meta Cloud API</p>
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-purple-600/80">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Connected
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
