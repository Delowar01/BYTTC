"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  Image,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Menu,
  PenLine,
  ScrollText,
  Settings,
  Sigma,
  Upload,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarRange,
  ClipboardList,
  FileText,
  GraduationCap,
  History,
  Image,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Menu,
  PenLine,
  ScrollText,
  Settings,
  Sigma,
  Upload,
  UserCog,
  Users,
};

type Item = { href: string; label: string; icon: string; group: string };

export function Sidebar({ items, brand }: { items: Item[]; brand: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const groups = [...new Set(items.map((i) => i.group))];
  // The most specific matching item is the active one.
  const active = items
    .filter((i) => pathname === i.href || (i.href !== "/admin" && pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  const nav = (
    <nav className="space-y-5 p-4 text-sm">
      {groups.map((g) => (
        <div key={g}>
          <p className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g}</p>
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.group === g)
              .map((i) => {
                const Icon = ICONS[i.icon] ?? FileText;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent",
                        active === i.href && "bg-secondary font-medium text-secondary-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b bg-background px-4 py-3 lg:hidden">
        <span className="font-semibold">{brand}</span>
        <button aria-label="Toggle navigation" onClick={() => setOpen(!open)} className="rounded p-1 hover:bg-accent">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && <div className="border-b bg-background lg:hidden">{nav}</div>}
      <aside className="hidden w-64 shrink-0 border-r bg-background lg:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto">
          <div className="border-b px-6 py-4">
            <Link href="/admin" className="font-semibold">
              {brand}
            </Link>
            <p className="text-xs text-muted-foreground">Management console</p>
          </div>
          {nav}
        </div>
      </aside>
    </>
  );
}
