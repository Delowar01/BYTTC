import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHero } from "@/components/public/page-hero";
import { getDictionary, getLocale, pick } from "@/lib/i18n";
import { getPage, getSettings, pageMetadata } from "@/lib/public-data";
import { ContactForm } from "./contact-form";

export const generateMetadata = () => pageMetadata("contact");

export default async function ContactPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const [page, s] = await Promise.all([getPage("contact"), getSettings()]);
  const mapUrl = s.map_embed_url?.startsWith("https://www.google.com/maps/embed") ? s.map_embed_url : null;
  return (
    <>
      <PageHero title={pick(locale, page?.title_en, page?.title_bn)} intro={pick(locale, page?.body_en, page?.body_bn)} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-3">
        <div className="space-y-4 text-sm">
          <p className="flex gap-3">
            <MapPin className="size-5 shrink-0 text-primary" /> {pick(locale, s.address_en, s.address_bn)}
          </p>
          {s.phone && (
            <p className="flex gap-3">
              <Phone className="size-5 shrink-0 text-primary" /> {s.phone}
            </p>
          )}
          {s.email && (
            <p className="flex gap-3">
              <Mail className="size-5 shrink-0 text-primary" /> {s.email}
            </p>
          )}
          {(s.office_hours_en || s.office_hours_bn) && (
            <p className="flex gap-3">
              <Clock className="size-5 shrink-0 text-primary" /> {pick(locale, s.office_hours_en, s.office_hours_bn)}
            </p>
          )}
          {mapUrl && <iframe src={mapUrl} title="Map" className="h-64 w-full rounded-lg border" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
        </div>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.contactForm}</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm t={t} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
