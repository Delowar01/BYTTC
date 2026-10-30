import type { Metadata } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import { getLocale } from "@/lib/i18n";
import { env } from "@/lib/env";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const bangla = Hind_Siliguri({ variable: "--font-bangla", subsets: ["bengali"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${bangla.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
