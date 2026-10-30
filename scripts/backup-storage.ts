/**
 * Download every object from the storage buckets (service role, read-only).
 *   npx tsx scripts/backup-storage.ts <output-dir>
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(".env.local");
} catch {
  // rely on the environment
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const out = process.argv[2];
if (!url || !key || !out) {
  console.error("Usage: backup-storage.ts <output-dir> (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function walk(bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const item of data) {
      const p = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) files.push(p);
      else files.push(...(await walk(bucket, p)));
    }
    if (data.length < 1000) break;
  }
  return files;
}

async function main() {
  const { data: buckets, error } = await db.storage.listBuckets();
  if (error) throw error;
  let total = 0;
  for (const b of buckets) {
    for (const p of await walk(b.id, "")) {
      const { data, error: dErr } = await db.storage.from(b.id).download(p);
      if (dErr) throw dErr;
      const target = path.join(out!, b.id, p);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(await data.arrayBuffer()));
      total++;
    }
  }
  console.log(`✔ ${total} file(s) from ${buckets.length} bucket(s)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
