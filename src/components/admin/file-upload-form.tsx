"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/admin/toaster";
import { initialFormState, type FormState } from "@/lib/forms";

export function FileUploadForm({
  action,
  accept,
  label = "Upload",
  inputLabel = "Document file",
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  accept?: string;
  label?: string;
  inputLabel?: string;
}) {
  const [, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message) toast(r.message, r.ok);
    return r;
  }, initialFormState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <Input type="file" name="file" accept={accept} required className="max-w-sm" aria-label={inputLabel} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />} {label}
      </Button>
    </form>
  );
}
