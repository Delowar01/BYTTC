"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "@/components/admin/toaster";
import { initialFormState, type FormState } from "@/lib/forms";

type Student = { id: string; label: string; issued: boolean };

/** Pick students (those without a valid document are preselected) and issue in bulk. */
export function IssueDocumentsForm({
  action,
  students,
  kind,
  exam,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  students: Student[];
  kind: "admit_card" | "registration_card";
  exam?: string;
}) {
  const [checked, setChecked] = useState(() => new Set(students.filter((s) => !s.issued).map((s) => s.id)));
  const [, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (r.message) toast(r.message, r.ok);
    return r;
  }, initialFormState);
  const pendingCount = students.filter((s) => !s.issued).length;
  const toggleAll = (on: boolean) => setChecked(new Set(on ? students.filter((s) => !s.issued).map((s) => s.id) : []));

  if (!students.length) return <p className="text-sm text-muted-foreground">No active students match these filters.</p>;
  return (
    <form action={formAction} className="space-y-4">
      {exam && <input type="hidden" name="exam" value={exam} />}
      <div className="flex flex-wrap items-end gap-3">
        {kind === "admit_card" ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="examinee_type">Type of examinee</Label>
              <NativeSelect id="examinee_type" name="examinee_type" className="w-40">
                <option>Regular</option>
                <option>Irregular</option>
                <option>Improvement</option>
                <option>Private</option>
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label htmlFor="seat_mode">Seat number</Label>
              <NativeSelect id="seat_mode" name="seat_mode" className="w-48">
                <option value="roll">Same as roll number</option>
                <option value="blank">Leave blank</option>
              </NativeSelect>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="valid_until">Valid until (optional)</Label>
            <Input id="valid_until" name="valid_until" type="date" className="w-44" />
          </div>
        )}
        <Button type="submit" disabled={pending || checked.size === 0}>
          {pending && <Loader2 className="animate-spin" />}
          Issue {kind === "admit_card" ? "admit cards" : "registration cards"} ({checked.size})
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-muted-foreground">
          {students.length} student(s), {pendingCount} without a valid {kind === "admit_card" ? "admit card for this exam" : "registration card"}.
        </span>
        <button type="button" className="text-primary underline" onClick={() => toggleAll(true)}>
          Select all not yet issued
        </button>
        <button type="button" className="text-primary underline" onClick={() => toggleAll(false)}>
          Clear
        </button>
      </div>
      <ul className="grid max-h-80 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2 lg:grid-cols-3">
        {students.map((s) => (
          <li key={s.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="student"
                value={s.id}
                disabled={s.issued}
                checked={checked.has(s.id)}
                onChange={(e) => {
                  const next = new Set(checked);
                  if (e.target.checked) next.add(s.id);
                  else next.delete(s.id);
                  setChecked(next);
                }}
                className="size-4 accent-primary"
              />
              <span className={s.issued ? "text-muted-foreground" : undefined}>
                {s.label}
                {s.issued && " — issued"}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </form>
  );
}
