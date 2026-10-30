"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/admin/toaster";
import { initialFormState, type FormState } from "@/lib/forms";

export function IssueForm({ action, exams }: { action: (s: FormState, f: FormData) => Promise<FormState>; exams: { id: string; label: string }[] }) {
  const [, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message) toast(r.message, r.ok);
    return r;
  }, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap gap-2">
      <NativeSelect name="exam" required className="max-w-md" aria-label="Exam">
        <option value="">Select an exam…</option>
        {exams.map((e) => (
          <option key={e.id} value={e.id}>
            {e.label}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Issue certificates
      </Button>
    </form>
  );
}
