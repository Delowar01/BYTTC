import { describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

vi.mock("server-only", () => ({}));
const { renderDocumentPdf, fillTemplate, scriptRuns } = await import("@/lib/documents/render");
const { DEFAULT_LAYOUTS } = await import("@/lib/documents/default-layouts");
const { sampleData, SAMPLE_MARKS } = await import("@/lib/documents/fields");
const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

describe("template text", () => {
  it("fills tokens and reports all-empty templates", () => {
    expect(fillTemplate("Roll No: {roll_no}", { roll_no: "100123" })).toEqual({ text: "Roll No: 100123", empty: false });
    expect(fillTemplate("son/daughter of {father_name} and {mother_name}", {})).toEqual({ text: "son/daughter of  and ", empty: true });
    expect(fillTemplate("Static title", {}).empty).toBe(false);
  });

  it("splits mixed Bangla/English text into script runs", () => {
    expect(scriptRuns("নাম: Rafiq Ahmed")).toEqual([
      { text: "নাম: ", bangla: true },
      { text: "Rafiq Ahmed", bangla: false },
    ]);
  });
});

describe("document renderer", () => {
  it("renders every default layout with sample data (A4, correct orientation)", async () => {
    for (const type of ["marksheet", "certificate", "admit_card", "registration_card"] as const) {
      const bytes = await renderDocumentPdf([{ layout: DEFAULT_LAYOUTS[type], data: sampleData(type, "https://example.org"), marks: SAMPLE_MARKS }], { title: type, author: "Test" });
      const doc = await PDFDocument.load(bytes);
      const { width, height } = doc.getPage(0).getSize();
      expect(DEFAULT_LAYOUTS[type].orientation === "landscape" ? width > height : height > width, type).toBe(true);
      const text = (await pdfParse(Buffer.from(bytes))).text;
      expect(text, type).toContain("Rafiq Ahmed (Sample)");
    }
  });

  it("puts the marks table and grade on the marksheet", async () => {
    const bytes = await renderDocumentPdf([{ layout: DEFAULT_LAYOUTS.marksheet, data: sampleData("marksheet", "https://example.org"), marks: SAMPLE_MARKS }], { title: "m", author: "t" });
    const text = (await pdfParse(Buffer.from(bytes))).text;
    for (const s of ["Detailed Marks", "Written", "Viva", "Letter Grade", "158", "200", "CGPA 3.75 on a scale of 4.00"]) expect(text).toContain(s);
  });

  it("produces one page per document for bulk output and stamps overlays", async () => {
    const page = { layout: DEFAULT_LAYOUTS.admit_card, data: sampleData("admit_card", "https://example.org") };
    const bytes = await renderDocumentPdf([page, page, { ...page, overlay: "REVOKED" }], { title: "bulk", author: "t" });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
    expect((await pdfParse(Buffer.from(bytes))).text).toContain("REVOKED");
  });
});
