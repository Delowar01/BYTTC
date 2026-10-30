import { describe, expect, it, vi } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";

vi.mock("server-only", () => ({}));
const { drawShapedCentered, hasBangla } = await import("@/lib/bangla-text");

describe("Bangla text in PDFs (HarfBuzz shaping)", () => {
  it("detects Bengali script", () => {
    expect(hasBangla("সাদিয়া ইসলাম")).toBe(true);
    expect(hasBangla("Sadia Islam")).toBe(false);
  });

  it("loads the fonts and WASM shaper and draws vector glyphs", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([842, 595]);
    await drawShapedCentered(page, "সারথি টেকনিক্যাল ট্রেনিং নেটওয়ার্ক", 300, 18, rgb(0, 0, 0));
    await drawShapedCentered(page, "সাদিয়া ইসলাম", 260, 17, rgb(0, 0, 0), "bold");
    const bytes = await pdf.save({ useObjectStreams: false });
    expect(bytes.byteLength).toBeGreaterThan(5_000); // glyph outlines are in the content stream
  });
});
