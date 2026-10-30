"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { initialFormState, type FormState } from "@/lib/forms";

type Rule = { min_percent: number; grade: string; point: number };
type Props = {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  initial: { code: string; name: string; max_point: number; rules: Rule[] };
  lockCode?: boolean;
};

export function ScaleEditor({ action, initial, lockCode }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [scale, setScale] = useState(initial);
  const setRule = (i: number, patch: Partial<Rule>) => setScale({ ...scale, rules: scale.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="scale" value={JSON.stringify(scale)} />
      {state.message && (
        <Alert variant={state.ok ? "success" : "destructive"}>
          <AlertDescription className={state.ok ? "text-inherit" : undefined}>{state.message}</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor={`code-${initial.code}`}>Code</Label>
          <Input id={`code-${initial.code}`} value={scale.code} disabled={lockCode} onChange={(e) => setScale({ ...scale, code: e.target.value.toUpperCase() })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`name-${initial.code}`}>Name</Label>
          <Input id={`name-${initial.code}`} value={scale.name} onChange={(e) => setScale({ ...scale, name: e.target.value })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`max-${initial.code}`}>Maximum grade point</Label>
          <Input id={`max-${initial.code}`} type="number" step="0.01" value={scale.max_point} onChange={(e) => setScale({ ...scale, max_point: Number(e.target.value) })} />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1">From %</th>
            <th className="py-1">Grade</th>
            <th className="py-1">Grade point</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {scale.rules.map((r, i) => (
            <tr key={i}>
              <td className="py-1 pr-2">
                <Input type="number" step="0.01" aria-label={`From % row ${i + 1}`} value={r.min_percent} onChange={(e) => setRule(i, { min_percent: Number(e.target.value) })} />
              </td>
              <td className="py-1 pr-2">
                <Input aria-label={`Grade row ${i + 1}`} value={r.grade} onChange={(e) => setRule(i, { grade: e.target.value })} />
              </td>
              <td className="py-1 pr-2">
                <Input type="number" step="0.01" aria-label={`Grade point row ${i + 1}`} value={r.point} onChange={(e) => setRule(i, { point: Number(e.target.value) })} />
              </td>
              <td>
                <Button type="button" variant="ghost" size="icon" aria-label={`Remove row ${i + 1}`} onClick={() => setScale({ ...scale, rules: scale.rules.filter((_, j) => j !== i) })}>
                  <Trash2 />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setScale({ ...scale, rules: [...scale.rules, { min_percent: 0, grade: "", point: 0 }] })}>
          <Plus /> Add row
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Save as new version
        </Button>
      </div>
    </form>
  );
}
