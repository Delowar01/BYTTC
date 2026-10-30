"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Download, Loader2, Printer, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import type { Dictionary } from "@/lib/i18n";
import { lookupResult, type LookupState } from "./actions";
import type { LookupMethod } from "./lookup";

type Org = { name: string; nameBn: string | null; registrationNo: string | null; logoUrl: string | null };
type Props = { t: Dictionary; locale: "en" | "bn"; org: Org; disclaimer: string };

export function ResultSearch({ t, locale, org, disclaimer }: Props) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupResult, { status: "idle", method: "roll_reg" });
  const [method, setMethod] = useState<LookupMethod>(state.method);
  const methods: [LookupMethod, string][] = [
    ["roll_reg", t.methodRollReg],
    ["passport_roll", t.methodPassportRoll],
    ["passport_reg", t.methodPassportReg],
  ];
  const firstLabel = method === "roll_reg" ? t.rollNo : t.passportNo;
  const secondLabel = method === "passport_roll" ? t.rollNo : t.registrationNo;
  const fmt = (v: string) => (locale === "bn" ? v.replace(/[0-9]/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]) : v);

  return (
    <div className="space-y-6">
      <Card className="no-print">
        <CardContent className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.searchBy}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {methods.map(([m, label]) => (
                <label key={m} className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${method === m ? "border-primary bg-secondary font-medium text-secondary-foreground" : ""}`}>
                  <input type="radio" name="method-choice" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="method" value={method} />
            <div className="space-y-2">
              <Label htmlFor="first">{firstLabel}</Label>
              <Input id="first" name="first" required defaultValue={state.method === method ? state.first : ""} autoComplete="off" maxLength={20} key={`first-${method}`} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="second">{secondLabel}</Label>
              <Input id="second" name="second" required defaultValue={state.method === method ? state.second : ""} autoComplete="off" maxLength={20} key={`second-${method}`} />
            </div>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t.showResult}
            </Button>
            {method !== "roll_reg" && <p className="text-xs text-muted-foreground sm:col-span-3">{t.passportHint}</p>}
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
        state.results?.map(({ data: d, marks, isPass, photoUrl }) => {
          const details: [string, string][] = [
            [t.studentName, locale === "bn" && d.student_name_bn ? d.student_name_bn : d.student_name],
            [t.rollNo, d.roll_no],
            [t.fatherName, d.father_name],
            [t.registrationNo, d.registration_no],
            [t.motherName, d.mother_name],
            [t.session, d.session_name],
            [t.course, d.course_title],
            [t.courseDuration, d.course_duration],
            [t.instituteNameCode, `${d.institute_code} - ${d.institute_name}`],
            [t.passingYear, d.passing_year],
            [t.instituteRegNo, d.institute_registration_no],
            [t.dateOfBirth, d.date_of_birth],
          ].filter(([, v]) => v) as [string, string][];
          return (
            <Card key={d.exam_code} data-testid="result-card" className="gap-4 print:border-0 print:shadow-none">
              <CardContent className="space-y-5">
                <div className="text-center">
                  {org.logoUrl && <img src={org.logoUrl} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />}
                  <p className="text-2xl font-semibold tracking-tight">{org.name}</p>
                  {org.registrationNo && <p className="text-sm text-muted-foreground">{t.orgRegNo} {org.registrationNo}</p>}
                  <p className="mt-1 text-sm font-medium text-primary">{d.exam_name}</p>
                </div>
                {photoUrl && <img src={photoUrl} alt={d.student_name} className="mx-auto h-36 w-28 rounded border object-cover" data-testid="result-photo" />}
                <dl className="grid overflow-hidden rounded-md border text-sm sm:grid-cols-2" data-testid="result-details">
                  {details.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[minmax(7rem,40%)_1fr] border-b sm:odd:border-r">
                      <dt className="bg-muted/60 px-3 py-2 text-muted-foreground">{k}</dt>
                      <dd className="px-3 py-2 font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="overflow-x-auto rounded-md border">
                  <p className="border-b bg-muted/60 px-3 py-2 text-center text-sm font-semibold">{t.detailedMarks}</p>
                  <table className="w-full text-center text-sm" data-testid="marks-table">
                    <thead>
                      <tr className="border-b">
                        {[t.written, t.practical, t.viva, t.total, t.fullMarks, t.letterGrade].map((h) => (
                          <th key={h} className="px-2 py-2 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {[marks.theory, marks.practical, marks.viva, marks.total, marks.full, marks.grade].map((v, i) => (
                          <td key={i} className="px-2 py-2">
                            {fmt(v || "—")}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    {isPass ? <CheckCircle2 className="size-8 text-emerald-600" /> : <XCircle className="size-8 text-destructive" />}
                    <div>
                      <p className="text-sm text-muted-foreground">{t.result}</p>
                      <p className="text-lg font-bold" data-testid="result-verdict">
                        {isPass ? t.passed : t.failed}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      {t.grade} · {t.percentage} {fmt(d.percentage)}%
                    </p>
                    <p className="text-2xl font-bold text-primary" data-testid="result-grade">
                      {d.grade} <span className="text-base text-muted-foreground">({fmt(d.gpa_text || d.grade_point)})</span>
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {d.published_on && `${t.publishedOn}: ${d.published_on} · `}
                  {disclaimer}
                </p>
                <div className="no-print flex flex-wrap gap-2">
                  <form method="post" action="/results/sheet">
                    <input type="hidden" name="method" value={state.method} />
                    <input type="hidden" name="first" value={state.first} />
                    <input type="hidden" name="second" value={state.second} />
                    <input type="hidden" name="exam" value={d.exam_code} />
                    <Button type="submit" className="bg-brand-accent text-[oklch(0.25_0.05_70)] hover:bg-brand-accent/90">
                      <Download /> {t.downloadSheet}
                    </Button>
                  </form>
                  <Button variant="outline" onClick={() => window.print()}>
                    <Printer /> {t.print}
                  </Button>
                  <Button variant="outline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                    <RotateCcw /> {t.searchAgain}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
