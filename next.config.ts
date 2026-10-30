import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // HarfBuzz (WASM) shapes Bangla text in certificate PDFs; load it from node_modules.
  serverExternalPackages: ["harfbuzzjs"],
  outputFileTracingIncludes: {
    "/admin/certificates/**": ["./src/assets/fonts/**", "./node_modules/harfbuzzjs/dist/*.wasm"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Import files are capped at 4 MB in the app (Vercel limits bodies to 4.5 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
