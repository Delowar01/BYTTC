import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = createPublicClient();
  const [{ data: courses }, { data: pages }, { data: notices }] = await Promise.all([
    db.from("courses").select("code, updated_at"),
    db.from("pages").select("slug, is_system, updated_at").eq("is_system", false),
    db.from("notices").select("id, updated_at").order("published_at", { ascending: false }).limit(200),
  ]);
  const base = env.siteUrl.replace(/\/$/, "");
  return [
    ...["", "/about", "/courses", "/institutes", "/notices", "/results", "/verify", "/contact"].map((p) => ({ url: `${base}${p}` })),
    ...(courses ?? []).map((c) => ({ url: `${base}/courses/${c.code}`, lastModified: c.updated_at })),
    ...(pages ?? []).map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updated_at })),
    ...(notices ?? []).map((n) => ({ url: `${base}/notices/${n.id}`, lastModified: n.updated_at })),
  ];
}
