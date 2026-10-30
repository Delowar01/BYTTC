"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Dictionary } from "@/lib/i18n";
import { submitApplication, type ApplyState } from "./actions";

type Props = { t: Dictionary; courses: { code: string; title: string }[] };

export function ApplyForm({ t, courses }: Props) {
  const [state, action, pending] = useActionState<ApplyState, FormData>(submitApplication, { status: "idle" });
  if (state.status === "sent") {
    return (
      <Alert variant="success" data-testid="application-sent">
        <CheckCircle2 />
        <AlertDescription className="text-inherit">
          <p>
            {t.applicationReceived} <strong data-testid="application-ref">{state.reference}</strong>
          </p>
          <p>{t.applicationNext}</p>
        </AlertDescription>
      </Alert>
    );
  }
  const bad = (k: string) => (state.errors?.[k] ? true : undefined);
  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {props.required && " *"}
      </Label>
      <Input id={name} name={name} aria-invalid={bad(name)} {...props} />
    </div>
  );
  return (
    <form action={action} className="space-y-8">
      {(state.status === "invalid" || state.status === "error") && (
        <Alert variant="destructive">
          <AlertDescription>{state.message ?? t.invalidInput}</AlertDescription>
        </Alert>
      )}
      {state.status === "limited" && (
        <Alert variant="warning">
          <AlertDescription className="text-inherit">{t.tooManyAttempts}</AlertDescription>
        </Alert>
      )}
      <div className="hidden" aria-hidden>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-lg font-semibold">{t.applyInstitute}</legend>
        {field("name_en", t.instituteNameEn, { required: true, minLength: 3, maxLength: 200 })}
        {field("name_bn", t.instituteNameBn, { maxLength: 200 })}
        {field("head_name", t.headName, { required: true, maxLength: 120 })}
        {field("established_year", t.establishedYear, { type: "number", min: 1900, max: 2100 })}
        {field("district", t.district, { required: true, maxLength: 60 })}
        {field("phone", t.phone, { required: true, maxLength: 30 })}
        {field("email", t.email, { required: true, type: "email" })}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">{t.address} *</Label>
          <Textarea id="address" name="address" rows={2} required maxLength={500} aria-invalid={bad("address")} />
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-lg font-semibold">{t.coursesWanted}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {courses.map((c) => (
            <label key={c.code} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="courses" value={c.code} className="size-4" /> {c.title}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-lg font-semibold">{t.applyApplicant}</legend>
        {field("applicant_name", t.yourName, { required: true, maxLength: 120 })}
        {field("applicant_phone", t.phone, { required: true, maxLength: 30 })}
        {field("applicant_email", t.email, { required: true, type: "email" })}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="documents">{t.documents}</Label>
        <Input id="documents" name="documents" type="file" multiple accept="application/pdf,image/jpeg,image/png" aria-invalid={bad("documents")} />
        <p className="text-xs text-muted-foreground">{t.documentsHelp}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="application_note">{t.note}</Label>
        <Textarea id="application_note" name="application_note" rows={3} maxLength={2000} />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {t.submitApplication}
      </Button>
    </form>
  );
}
