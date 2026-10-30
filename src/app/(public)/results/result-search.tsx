"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Printer, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import { lookupResult, type LookupState } from "./actions";

type Props = { t: Dictionary; locale: "en" | "bn"; issuer: string; disclaimer: string };

export function ResultSearch({ t, locale, issuer, disclaimer }: Props) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupResult, { status: "idle" });
  const fmt = (n: number | null) => (n === null ? "—" : Number(n).toLocaleString(locale === "bn" ? "bn-BD" : "en", { maximumFractionDigits: 2 }));
  return (
    <div className="space-y-6">
      <Card className="no-print">
        <CardContent>
          <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="roll">{t.rollNo}</Label>
              <Input id="roll" name="roll" required defaultValue={state.roll} autoComplete="off" inputMode="text" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">{t.registrationNo}</Label>
              <Input id="registration" name="registration" required defaultValue={state.registration} autoComplete="off" maxLength={20} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t.showResult}
            </Button>
          </form>
        </CardContent>
      </Card>

      {(state.status === "not_found" || state.status === "invalid") && (
        <Alert variant="destructive" data-testid="result-not-found">
          <AlertDescription>{t.resultNotFound}</AlertDescription>
        </Alert>
      )}
      {state.status === "limited" && (
        <Alert variant="warning">
          <AlertDescription className="text-inherit">{t.tooManyAttempts}</AlertDescription>
        </Alert>
      )}

      {state.status === "found" &&
        state.results?.map((r) => (
          <Card key={r.exam_code} data-testid="result-card" className="print:border-0 print:shadow-none">
            <CardHeader className="border-b">
              <p className="text-sm text-muted-foreground">{issuer}</p>
              <CardTitle className="text-xl">{r.exam_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {r.course_title} · {r.session_name}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  [t.studentName, locale === "bn" && r.student_name_bn ? r.student_name_bn : r.student_name],
                  [t.rollNo, r.roll_no],
                  [t.registrationNo, r.registration_no],
                  [t.institute, `${r.institute_name} (${r.institute_code})`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-dashed py-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  [t.theory, fmt(r.theory_marks)],
                  [t.practical, fmt(r.practical_marks)],
                  [t.total, `${fmt(r.total_marks)} / ${fmt(r.full_marks)}`],
                  [t.percentage, `${fmt(r.percentage)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg bg-muted p-3 text-center">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="text-lg font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {r.is_pass ? <CheckCircle2 className="size-8 text-emerald-600" /> : <XCircle className="size-8 text-destructive" />}
                  <div>
                    <p className="text-sm text-muted-foreground">{t.result}</p>
                    <p className="text-lg font-bold" data-testid="result-verdict">
                      {r.is_pass ? t.passed : t.failed}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {t.grade} / {t.gpa}
                  </p>
                  <p className="text-2xl font-bold text-primary" data-testid="result-grade">
                    {r.grade} <span className="text-base text-muted-foreground">({fmt(r.grade_point)})</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.publishedOn}: {r.published_at ? new Date(r.published_at).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" }) : "—"} · {disclaimer || t.resultDisclaimer}
              </p>
              <Button variant="outline" className="no-print" onClick={() => window.print()}>
                <Printer /> {t.print}
              </Button>
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
