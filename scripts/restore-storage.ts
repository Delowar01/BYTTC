/** Upload a storage backup folder (<bucket>/<path>) into the target project. */
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
const dir = process.argv[2];
if (!url || !key || !dir) {
  console.error("Usage: restore-storage.ts <backup-storage-dir>");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

function* files(root: string, rel = ""): Generator<string> {
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const p = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) yield* files(root, p);
    else yield p;
  }
}

async function main() {
  if (!fs.existsSync(dir!)) return console.log("No storage files in backup.");
  let n = 0;
  for (const bucket of fs.readdirSync(dir!)) {
    for (const p of files(path.join(dir!, bucket))) {
      const { error } = await db.storage.from(bucket).upload(p, fs.readFileSync(path.join(dir!, bucket, p)), { upsert: true });
      if (error) throw new Error(`${bucket}/${p}: ${error.message}`);
      n++;
    }
  }
  console.log(`✔ ${n} file(s) uploaded`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
