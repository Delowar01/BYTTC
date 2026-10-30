"use client";

import { useActionState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/admin/toaster";
import { initialFormState, type FormState } from "@/lib/forms";

export function NewTemplateForm({ action, types }: { action: (s: FormState, f: FormData) => Promise<FormState>; types: { value: string; label: string }[] }) {
  const [, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message) toast(r.message, r.ok);
    return r;
  }, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <NativeSelect name="doc_type" required className="w-56" aria-label="Document type">
        <option value="">Document type…</option>
        {types.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </NativeSelect>
      <Input name="name" required minLength={2} maxLength={120} placeholder="Template name" aria-label="Template name" className="max-w-xs" />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Plus />} Create draft
      </Button>
    </form>
  );
}
