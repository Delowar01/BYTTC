import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { resolveImageField } = await import("@/lib/storage");

const fd = (value: string) => {
  const f = new FormData();
  f.set("attachment_url", value);
  return f;
};
// No file is attached, so the storage client is never used.
const client = {} as Parameters<typeof resolveImageField>[0];

describe("resolveImageField URL validation", () => {
  it("accepts https URLs and site paths", async () => {
    expect(await resolveImageField(client, fd("https://cdn.example.org/a.pdf"), "attachment_url", "x")).toEqual({ url: "https://cdn.example.org/a.pdf" });
    expect(await resolveImageField(client, fd("/files/a.pdf"), "attachment_url", "x")).toEqual({ url: "/files/a.pdf" });
    expect(await resolveImageField(client, fd("  "), "attachment_url", "x")).toEqual({ url: null });
  });
  it("rejects script and protocol-relative URLs", async () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>", "//evil.example/x"]) {
      expect((await resolveImageField(client, fd(bad), "attachment_url", "x")).error).toBeTruthy();
    }
  });
});
