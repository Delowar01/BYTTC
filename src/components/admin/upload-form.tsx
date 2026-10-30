"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/forms";

export function UploadForm({ action }: { action: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  return (
    <form action={formAction} className="space-y-4">
      {state.message && (
        <Alert variant="destructive">
          <AlertTitle>File rejected</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="file">Spreadsheet file (.xlsx or .csv, max 4 MB)</Label>
        <Input id="file" name="file" type="file" required accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Upload />}
        {pending ? "Validating…" : "Upload and validate"}
      </Button>
    </form>
  );
}
