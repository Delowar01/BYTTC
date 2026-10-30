import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
const { parseLayout } = await import("@/lib/documents/schema");
const { DEFAULT_LAYOUTS } = await import("@/lib/documents/default-layouts");
const { documentState } = await import("@/lib/documents/state");
const { snapshotData } = await import("@/lib/documents/issued");
const { renderDocumentPdf } = await import("@/lib/documents/render");
const { sampleData } = await import("@/lib/documents/fields");
const { normalizeAsset, normalizeBackground } = await import("@/lib/documents/uploads");
const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

const blankPng = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#f3efe2" } }).png().toBuffer();

describe("layout validation", () => {
  it("accepts every built-in layout", () => {
    for (const [type, layout] of Object.entries(DEFAULT_LAYOUTS)) expect(parseLayout(JSON.stringify(layout)).ok, type).toBe(true);
  });

  it("rejects malformed or unsafe layouts", () => {
    const base = DEFAULT_LAYOUTS.admit_card;
    const bad: [string, unknown][] = [
      ["not json", "{"],
      ["unknown kind", { ...base, fields: [{ id: "x", kind: "script", x: 1, y: 1 }] }],
      ["off page", { ...base, fields: [{ id: "x", kind: "qr", x: 120, y: 1, w: 10 }] }],
      ["bad colour", { ...base, fields: [{ id: "x", kind: "text", text: "a", x: 1, y: 1, w: 10, size: 10, color: "red;" }] }],
      ["asset outside folder", { ...base, fields: [{ id: "x", kind: "image", source: "asset", asset: "../../private-documents/a.png", x: 1, y: 1, w: 10, h: 10 }] }],
      ["asset field without image", { ...base, fields: [{ id: "x", kind: "image", source: "asset", x: 1, y: 1, w: 10, h: 10 }] }],
      ["duplicate ids", { ...base, fields: [base.fields[0], base.fields[0]] }],
      ["huge text", { ...base, fields: [{ id: "x", kind: "text", text: "a".repeat(401), x: 1, y: 1, w: 10, size: 10 }] }],
    ];
    for (const [label, value] of bad) expect(parseLayout(value).ok, label).toBe(false);
  });

  it("drops unknown properties", () => {
    const r = parseLayout({ ...DEFAULT_LAYOUTS.admit_card, evil: true, fields: [{ id: "q", kind: "qr", x: 1, y: 1, w: 10, onclick: "x" }] });
    expect(r.ok && JSON.stringify(r.layout)).not.toMatch(/evil|onclick/);
  });
});

describe("issued document helpers", () => {
  it("derives the display state", () => {
    expect(documentState({ status: "valid", valid_until: null, revoke_reason: null })).toBe("valid");
    expect(documentState({ status: "valid", valid_until: "2000-01-01", revoke_reason: null })).toBe("expired");
    expect(documentState({ status: "revoked", valid_until: null, revoke_reason: "Issued in error" })).toBe("revoked");
    expect(documentState({ status: "revoked", valid_until: null, revoke_reason: "Superseded: name corrected" })).toBe("superseded");
  });

  it("turns snapshot JSON into template strings", () => {
    expect(snapshotData({ a: "x", b: null, c: 3.5, d: true })).toEqual({ a: "x", b: "", c: "3.5", d: "true" });
  });
});

describe("uploaded designs", () => {
  it("normalizes image designs and reports their orientation", async () => {
    const r = await normalizeBackground(new File([new Uint8Array(await blankPng(1754, 1240))], "design.png", { type: "image/png" }));
    expect(r).toMatchObject({ type: "png", orientation: "landscape" });
    expect("error" in (await normalizeBackground(new File([new Uint8Array(await blankPng(300, 400))], "tiny.png")))).toBe(true);
    expect("error" in (await normalizeBackground(new File([new TextEncoder().encode("<svg/>")], "x.svg")))).toBe(true);
  });

  it("keeps only the first page of PDF designs", async () => {
    const src = await PDFDocument.create();
    src.addPage([595, 842]);
    src.addPage([595, 842]);
    const r = await normalizeBackground(new File([new Uint8Array(await src.save())], "design.pdf"));
    expect(r).toMatchObject({ type: "pdf", orientation: "portrait" });
    expect((await PDFDocument.load((r as { bytes: Buffer }).bytes)).getPageCount()).toBe(1);
  });

  it("converts signature images to PNG", async () => {
    const jpg = await sharp({ create: { width: 400, height: 150, channels: 3, background: "#ffffff" } }).jpeg().toBuffer();
    const r = await normalizeAsset(new File([new Uint8Array(jpg)], "sig.jpg"));
    expect((await sharp((r as { bytes: Buffer }).bytes).metadata()).format).toBe("png");
  });

  it("renders fields on top of an uploaded PNG or PDF design", async () => {
    const png = new Uint8Array(await blankPng(1240, 1754));
    const design = await PDFDocument.create();
    design.addPage([595.28, 841.89]).drawText("BLANK DESIGN", { x: 50, y: 800, size: 12 });
    const pdf = new Uint8Array(await design.save());
    const layout = { ...DEFAULT_LAYOUTS.registration_card, frame: "none" as const };
    const data = sampleData("registration_card", "https://example.org");
    const bytes = await renderDocumentPdf(
      [
        { layout, data, background: { bytes: png, type: "png" } },
        { layout, data, background: { bytes: pdf, type: "pdf" } },
      ],
      { title: "t", author: "t" },
    );
    const text = (await pdfParse(Buffer.from(bytes))).text;
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
    expect(text).toContain("Rafiq Ahmed (Sample)");
    expect(text).toContain("BLANK DESIGN");
  });
});
