import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { Sidebar } from "@/components/admin/sidebar";
import { Toaster } from "@/components/admin/toaster";
import { NAV_ITEMS } from "@/components/admin/nav-items";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth";
import { ALL_STAFF, ROLE_LABELS } from "@/lib/roles";
import { signOut } from "@/app/login/actions";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { profile, supabase } = await requireRole(ALL_STAFF);
  const { data: settings } = await supabase.from("site_settings").select("short_name, org_name_en").eq("id", 1).maybeSingle();
  const items = NAV_ITEMS.filter((i) => i.roles.includes(profile.role)).map(({ href, label, icon, group }) => ({
    href,
    label,
    icon,
    group,
  }));
  const institute = profile.institutes;

  return (
    <div className="flex min-h-screen flex-col bg-muted/30 lg:flex-row">
      <div className="no-print contents">
        <Sidebar items={items} brand={settings?.short_name || settings?.org_name_en || "Admin"} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-2 lg:px-8">
          <div className="text-sm">
            <span className="font-medium">{profile.full_name || profile.email}</span>
            <span className="text-muted-foreground"> · {ROLE_LABELS[profile.role]}</span>
            {institute && <span className="text-muted-foreground"> · {institute.name_en}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/" target="_blank">
                <ExternalLink /> Website
              </Link>
            </Button>
            <form action={signOut}>
              <Button variant="outline" size="sm" type="submit">
                <LogOut /> Sign out
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
