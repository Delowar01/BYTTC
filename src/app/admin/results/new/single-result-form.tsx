"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/forms";
import { previewGrade, type GradeRule } from "@/lib/grading";

export type ExamOption = {
  id: string;
  label: string;
  theory_full: number;
  practical_full: number;
  viva_full: number;
  pass_marks: number;
  rules: GradeRule[];
  max_point: number;
  existingResultId: string | null;
};

type Props = { action: (s: FormState, f: FormData) => Promise<FormState>; exams: ExamOption[]; canSetDate: boolean };

const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

export function SingleResultForm({ action, exams, canSetDate }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [examId, setExamId] = useState(state.values?.exam_id ?? "");
  const [marks, setMarks] = useState({ theory: state.values?.theory_marks ?? "", practical: state.values?.practical_marks ?? "", viva: state.values?.viva_marks ?? "" });
  const exam = exams.find((e) => e.id === examId);
  const preview = exam
    ? previewGrade({ theory: num(marks.theory), practical: num(marks.practical), viva: num(marks.viva) }, { theory_full: exam.theory_full, practical_full: exam.practical_full, viva_full: exam.viva_full, pass_marks: exam.pass_marks }, exam.rules)
    : null;
  const err = (k: string) => state.errors?.[k];
  const markInput = (key: "theory" | "practical" | "viva", name: string, label: string, full: number) => (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} (of {full})
      </Label>
      <Input id={name} name={name} inputMode="decimal" value={marks[key]} onChange={(e) => setMarks({ ...marks, [key]: e.target.value })} aria-invalid={err(name) ? true : undefined} />
      {err(name) && <p className="text-xs text-destructive">{err(name)}</p>}
    </div>
  );
  return (
    <form action={formAction} className="space-y-6">
      {state.message && (
        <Alert variant="destructive">
          <AlertDescription>
            {state.message}{" "}
            {state.errors?._existing && (
              <Link className="font-medium underline" href={`/admin/results/${state.errors._existing}`}>
                Edit existing result
              </Link>
            )}
          </AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="exam_id">Examination</Label>
        <NativeSelect id="exam_id" name="exam_id" required value={examId} onChange={(e) => setExamId(e.target.value)}>
          <option value="">Select an exam…</option>
          {exams.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
              {e.existingResultId ? " — result exists" : ""}
            </option>
          ))}
        </NativeSelect>
        {err("exam_id") && <p className="text-xs text-destructive">{err("exam_id")}</p>}
      </div>
      {exam?.existingResultId && (
        <Alert variant="warning">
          <AlertDescription className="text-inherit">
            A result already exists for this exam.{" "}
            <Link className="font-medium underline" href={`/admin/results/${exam.existingResultId}`}>
              Edit result
            </Link>
          </AlertDescription>
        </Alert>
      )}
      {exam && !exam.existingResultId && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {markInput("theory", "theory_marks", "Written / theory", exam.theory_full)}
            {exam.practical_full > 0 && markInput("practical", "practical_marks", "Practical", exam.practical_full)}
            {exam.viva_full > 0 && markInput("viva", "viva_marks", "Viva", exam.viva_full)}
          </div>
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" rows={2} maxLength={500} defaultValue={state.values?.remarks} />
          </div>
          {canSetDate && (
            <div className="max-w-xs space-y-2">
              <Label htmlFor="display_published_on">Displayed result publication date (optional)</Label>
              <Input id="display_published_on" name="display_published_on" type="date" defaultValue={state.values?.display_published_on} />
              <p className="text-xs text-muted-foreground">Defaults to the day it is first published. The actual publication time is recorded separately.</p>
            </div>
          )}
          {preview && (
            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/40 p-4 text-sm sm:grid-cols-5" data-testid="result-preview">
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold">
                  {preview.total} / {preview.full}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Percentage</p>
                <p className="font-semibold">{preview.percentage}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grade</p>
                <p className="font-semibold">{preview.grade}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Grade point</p>
                <p className="font-semibold">
                  {preview.point.toFixed(2)} / {exam.max_point.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Result</p>
                <p className={preview.pass ? "font-semibold text-emerald-700" : "font-semibold text-destructive"}>{preview.pass ? "Pass" : "Fail"}</p>
              </div>
            </div>
          )}
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Save as draft
          </Button>
        </>
      )}
    </form>
  );
}
