"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/admin/toaster";
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

/**
 * A single-button form for row actions (delete, approve, publish, ...).
 * Results are reported as toasts because a successful action usually
 * removes or replaces this very button.
 */
export function ActionButton({ action, label, confirm, variant = "outline", size = "sm", fields, reasonPrompt }: Props) {
  const [, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result.message) toast(result.message, result.ok);
    return result;
  }, initialFormState);
  return (
    <form
      action={formAction}
      className="inline-flex"
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
    </form>
  );
}
