import { Suspense } from "react";
import Link from "next/link";
import { GraduationCap, Mail, Menu, Phone } from "lucide-react";
import { LangSwitch } from "@/components/public/lang-switch";
import { getDictionary, pick, type Locale } from "@/lib/i18n";
import { getMenu, getSettings } from "@/lib/public-data";

export async function SiteHeader({ locale }: { locale: Locale }) {
  const [settings, menu] = await Promise.all([getSettings(), getMenu("header")]);
  const t = getDictionary(locale);
  const name = pick(locale, settings.org_name_en, settings.org_name_bn);
  return (
    <header className="no-print">
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            {settings.phone && (
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 hover:underline">
                <Phone className="size-3.5" /> {settings.phone}
              </a>
            )}
            {settings.email && (
              <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-1 hover:underline">
                <Mail className="size-3.5" /> {settings.email}
              </a>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Suspense>
              <LangSwitch to={locale === "bn" ? "en" : "bn"} label={t.langSwitch} />
            </Suspense>
            <Link href="/login" className="hover:underline">
              {t.login}
            </Link>
          </div>
        </div>
      </div>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="" className="size-11 rounded object-contain" />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <GraduationCap className="size-6" />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-base leading-tight font-bold sm:text-lg">{name}</span>
              <span className="block truncate text-xs text-muted-foreground">{pick(locale, settings.tagline_en, settings.tagline_bn)}</span>
            </span>
          </Link>
          <nav className="hidden lg:block" aria-label="Main">
            <ul className="flex items-center gap-1 text-sm">
              {menu.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="rounded-md px-2.5 py-2 font-medium hover:bg-secondary hover:text-secondary-foreground">
                    {pick(locale, m.label_en, m.label_bn)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <details className="relative lg:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-md border p-2" aria-label="Menu">
              <Menu className="size-5" />
            </summary>
            <nav className="absolute right-0 z-50 mt-2 w-60 rounded-lg border bg-background p-2 shadow-lg" aria-label="Main mobile">
              {menu.map((m) => (
                <Link key={m.href} href={m.href} className="block rounded-md px-3 py-2 text-sm hover:bg-secondary">
                  {pick(locale, m.label_en, m.label_bn)}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
