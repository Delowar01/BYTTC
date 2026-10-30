"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/admin/toaster";
import { initialFormState, type FormState } from "@/lib/forms";

/** Reissue with corrected details; the current document becomes "superseded". */
export function ReissueForm({
  action,
  kind,
  defaults,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  kind: string;
  defaults: { seat_no?: string; examinee_type?: string; valid_until?: string | null };
}) {
  const [, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message) toast(r.message, r.ok);
    return r;
  }, initialFormState);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="open" value="1" />
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === "admit_card" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="seat_no">Seat number</Label>
              <Input id="seat_no" name="seat_no" defaultValue={defaults.seat_no ?? ""} maxLength={20} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="examinee_type">Type of examinee</Label>
              <Input id="examinee_type" name="examinee_type" defaultValue={defaults.examinee_type ?? "Regular"} maxLength={30} />
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="valid_until">Valid until</Label>
            <Input id="valid_until" name="valid_until" type="date" defaultValue={defaults.valid_until ?? ""} />
          </div>
        )}
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="reason">Reason for reissue (audited)</Label>
          <Input id="reason" name="reason" required maxLength={500} placeholder="e.g. corrected father's name" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">The new document uses the current student and exam records and the active template.</p>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Reissue
      </Button>
    </form>
  );
}
