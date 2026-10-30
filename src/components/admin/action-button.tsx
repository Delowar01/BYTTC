"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  label: string;
  confirm?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  fields?: Record<string, string>;
  /** Ask for a free-text reason (sent as `reason`). */
  reasonPrompt?: string;
};

/** A single-button form for row actions (delete, approve, publish, ...). */
export function ActionButton({ action, label, confirm, variant = "outline", size = "sm", fields, reasonPrompt }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form
      action={formAction}
      className="inline-flex flex-col items-start gap-1"
      onSubmit={(e) => {
        if (reasonPrompt) {
          const reason = window.prompt(reasonPrompt);
          if (!reason || !reason.trim()) {
            e.preventDefault();
            return;
          }
          const input = e.currentTarget.elements.namedItem("reason") as HTMLInputElement;
          input.value = reason.trim();
        } else if (confirm && !window.confirm(confirm)) {
          e.preventDefault();
        }
      }}
    >
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {reasonPrompt && <input type="hidden" name="reason" />}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {label}
      </Button>
      {state.message && (
        <span role="status" className={state.ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
          {state.message}
        </span>
      )}
    </form>
  );
}
