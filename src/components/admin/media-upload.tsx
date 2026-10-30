"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialFormState, type FormState } from "@/lib/forms";

export function MediaUpload({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input type="file" name="files" multiple accept="image/*,application/pdf" className="max-w-sm" aria-label="Files" />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} Upload
      </Button>
      {state.message && <span className={state.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{state.message}</span>}
    </form>
  );
}
