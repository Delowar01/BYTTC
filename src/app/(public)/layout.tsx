import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { getLocale } from "@/lib/i18n";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <>
      <SiteHeader locale={locale} />
      <main className="flex-1">{children}</main>
      <SiteFooter locale={locale} />
    </>
  );
}
