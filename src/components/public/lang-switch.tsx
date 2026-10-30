"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Languages } from "lucide-react";

export function LangSwitch({ to, label }: { to: "en" | "bn"; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const next = pathname + (search.size ? `?${search.toString()}` : "");
  return (
    <a href={`/lang?to=${to}&next=${encodeURIComponent(next)}`} className="inline-flex items-center gap-1 rounded-md border border-white/30 px-2 py-1 text-xs font-medium hover:bg-white/10" lang={to}>
      <Languages className="size-3.5" />
      {label}
    </a>
  );
}
