import Link from "next/link";
import { getDictionary, pick, type Locale } from "@/lib/i18n";
import { getMenu, getSettings } from "@/lib/public-data";
import { localizeDigits } from "@/lib/utils";

export async function SiteFooter({ locale }: { locale: Locale }) {
  const [settings, menu] = await Promise.all([getSettings(), getMenu("footer")]);
  const t = getDictionary(locale);
  const name = pick(locale, settings.org_name_en, settings.org_name_bn);
  return (
    <footer className="no-print mt-16 bg-[oklch(0.25_0.04_200)] text-sm text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-base font-semibold text-white">{name}</p>
          <p className="mt-2">{pick(locale, settings.footer_text_en, settings.footer_text_bn)}</p>
        </div>
        <div>
          <p className="font-semibold text-white">{t.quickLinks}</p>
          <ul className="mt-2 space-y-1">
            {menu.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="hover:text-white hover:underline">
                  {pick(locale, m.label_en, m.label_bn)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-white">{t.address}</p>
          <p>{pick(locale, settings.address_en, settings.address_bn)}</p>
          {settings.phone && <p>{settings.phone}</p>}
          {settings.email && <p>{settings.email}</p>}
          {(settings.office_hours_en || settings.office_hours_bn) && (
            <p>
              {t.officeHours}: {pick(locale, settings.office_hours_en, settings.office_hours_bn)}
            </p>
          )}
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl space-y-1 px-4 py-4 text-xs text-white/60">
          <p data-testid="disclaimer">{pick(locale, settings.disclaimer_en, settings.disclaimer_bn)}</p>
          <p>
            © {localizeDigits(new Date().getFullYear(), locale)} {name}
          </p>
        </div>
      </div>
    </footer>
  );
}
