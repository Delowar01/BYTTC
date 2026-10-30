"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";

type Props = {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  name: string;
  options: { value: string; label: string; checked: boolean; hint?: string }[];
  submitLabel?: string;
  disabled?: boolean;
};

export function CheckboxGroupForm({ action, name, options, submitLabel = "Save", disabled }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={name} value={o.value} defaultChecked={o.checked} disabled={disabled} className="size-4" />
            {o.label}
            {o.hint && <span className="text-xs text-amber-700">({o.hint})</span>}
          </label>
        ))}
      </div>
      {!disabled && (
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
          {state.message && <span className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</span>}
        </div>
      )}
    </form>
  );
}
