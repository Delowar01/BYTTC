"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Toast = { id: number; message: string; ok: boolean };
const EVENT = "app-toast";

/** Show a notification that survives re-renders of the component that triggered it. */
export function toast(message: string, ok = true) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, ok } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const onToast = (e: Event) => {
      const { message, ok } = (e as CustomEvent<{ message: string; ok: boolean }>).detail;
      const id = Date.now() + Math.random();
      setItems((list) => [...list, { id, message, ok }]);
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), ok ? 5000 : 10000);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex max-w-sm flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.ok ? "status" : "alert"}
          className={cn(
            "pointer-events-auto flex items-start gap-2 rounded-lg border bg-background px-4 py-3 text-sm shadow-lg",
            t.ok ? "border-emerald-300" : "border-destructive/50 text-destructive",
          )}
        >
          {t.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
