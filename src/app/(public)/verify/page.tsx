import { BadgeCheck, ShieldX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHero } from "@/components/public/page-hero";
import { allowRequest } from "@/lib/client-key";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, getSettings, pageMetadata } from "@/lib/public-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/utils";

export const generateMetadata = () => pageMetadata("verify");

/** Certificate verification. GET ?no=… so QR codes can link straight here. */
export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [page, settings] = await Promise.all([getPage("verify"), getSettings()]);
  const raw = (await searchParams).no;
  const no = typeof raw === "string" ? raw.trim().toUpperCase().slice(0, 40) : "";

  let outcome: "none" | "limited" | "not_found" | "found" = "none";
  let cert = null;
  if (no) {
    if (!/^[A-Z0-9-]{4,40}$/.test(no)) outcome = "not_found";
    else if (!(await allowRequest("certificate_verify", 60, "10 minutes"))) outcome = "limited";
    else {
      const { data } = await createAdminClient().rpc("public_verify_certificate", { p_certificate_no: no });
      cert = data?.[0] ?? null;
      outcome = cert ? "found" : "not_found";
    }
  }

  return (
    <>
      <PageHero title={pick(locale, page?.title_en, page?.title_bn)} intro={pick(locale, page?.body_en, page?.body_bn)} />
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        <Card>
          <CardContent>
            <form className="flex flex-col gap-2 sm:flex-row" role="search">
              <Input name="no" defaultValue={no} required placeholder={t.certificateNo} aria-label={t.certificateNo} maxLength={40} />
              <Button type="submit">{t.verify}</Button>
            </form>
          </CardContent>
        </Card>
        {outcome === "limited" && (
          <Alert variant="warning">
            <AlertDescription className="text-inherit">{t.tooManyAttempts}</AlertDescription>
          </Alert>
        )}
        {outcome === "not_found" && (
          <Alert variant="destructive" data-testid="cert-not-found">
            <ShieldX />
            <AlertTitle>{t.certNotFound}</AlertTitle>
          </Alert>
        )}
        {outcome === "found" && cert && (
          <Card className={cert.status === "valid" ? "border-emerald-400" : "border-destructive"} data-testid="cert-card">
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                {cert.status === "valid" ? <BadgeCheck className="size-10 text-emerald-600" /> : <ShieldX className="size-10 text-destructive" />}
                <p className="text-lg font-semibold" data-testid="cert-status">
                  {cert.status === "valid" ? t.certValid : t.certRevoked}
                </p>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                {[
                  [t.certificateNo, cert.certificate_no],
                  [t.studentName, cert.student_name],
                  [t.rollNo, cert.roll_no],
                  [t.institute, cert.institute_name],
                  [t.course, cert.course_title],
                  [t.session, cert.session_name],
                  [t.grade, `${cert.grade} (${Number(cert.grade_point).toFixed(2)})`],
                  [t.issuedOn, formatDate(cert.issued_at, locale)],
                  ...(cert.revoked_at ? [[t.revokedOn, formatDate(cert.revoked_at, locale)]] : []),
                  [t.issuedBy, pick(locale, settings.org_name_en, settings.org_name_bn)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-dashed py-1">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
