"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/admin/status-badge";
import { initialFormState, type FormState } from "@/lib/forms";

export type MarksRow = {
  studentId: string;
  roll: string;
  name: string;
  institute: string;
  resultId: string | null;
  status: string | null;
  theory: number | null;
  practical: number | null;
  remarks: string | null;
  grade: string | null;
};

type Props = {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  rows: MarksRow[];
  theoryFull: number;
  practicalFull: number;
};

export function MarksGrid({ action, rows, theoryFull, practicalFull }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const val = (key: string, fallback: number | string | null) => (state.values && key in state.values ? state.values[key] : (fallback ?? "").toString());
  return (
    <form key={state.stamp ?? 0} action={formAction} className="space-y-4">
      {state.message && (
        <Alert variant={state.ok ? "success" : "destructive"}>
          <AlertDescription className={state.ok ? "text-inherit" : undefined}>{state.message}</AlertDescription>
        </Alert>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Roll</TableHead>
            <TableHead>Student</TableHead>
            <TableHead>Institute</TableHead>
            <TableHead className="w-28">Theory /{theoryFull}</TableHead>
            <TableHead className="w-28">Practical /{practicalFull}</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const locked = r.status === "published" || r.status === "unpublished";
            const tErr = state.errors?.[`t_${r.studentId}`];
            const pErr = state.errors?.[`p_${r.studentId}`];
            return (
              <TableRow key={r.studentId}>
                <TableCell className="font-mono">{r.roll}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.institute}</TableCell>
                <TableCell>
                  <Input name={`t_${r.studentId}`} aria-label={`Theory ${r.roll}`} inputMode="decimal" defaultValue={val(`t_${r.studentId}`, r.theory)} disabled={locked} aria-invalid={tErr ? true : undefined} title={tErr} className="h-8" />
                  {tErr && <p className="text-xs text-destructive">{tErr}</p>}
                </TableCell>
                <TableCell>
                  <Input name={`p_${r.studentId}`} aria-label={`Practical ${r.roll}`} inputMode="decimal" defaultValue={val(`p_${r.studentId}`, r.practical)} disabled={locked} aria-invalid={pErr ? true : undefined} title={pErr} className="h-8" />
                  {pErr && <p className="text-xs text-destructive">{pErr}</p>}
                </TableCell>
                <TableCell>
                  <Input name={`r_${r.studentId}`} aria-label={`Remarks ${r.roll}`} defaultValue={val(`r_${r.studentId}`, r.remarks)} disabled={locked} maxLength={500} className="h-8 min-w-32" />
                </TableCell>
                <TableCell>
                  {r.status ? <StatusBadge status={r.status} /> : <span className="text-xs text-muted-foreground">not entered</span>}
                  {r.grade && <span className="ml-1 text-xs">{r.grade}</span>}
                  {locked && r.resultId && (
                    <Link href={`/admin/results/${r.resultId}`} className="ml-2 text-xs text-primary hover:underline">
                      correct
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Button type="submit" disabled={pending || rows.length === 0}>
        {pending && <Loader2 className="animate-spin" />}
        Save marks as draft
      </Button>
    </form>
  );
}
