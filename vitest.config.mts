import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig(({ mode }) => ({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
    // Loads .env.local so DB tests reach the local Supabase stack.
    env: loadEnv(mode, process.cwd(), ""),
    // DB tests share one local database; run files sequentially.
    fileParallelism: false,
    testTimeout: 30_000,
  },
}));
