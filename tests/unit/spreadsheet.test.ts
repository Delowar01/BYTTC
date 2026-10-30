import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { checkColumns, csvSafe, MAX_IMPORT_BYTES, normalizeHeader, parseSpreadsheet, toCsv, toXlsx } from "@/lib/import/spreadsheet";

const enc = (s: string) => new TextEncoder().encode(s);

describe("normalizeHeader", () => {
  it("normalizes common header spellings", () => {
    expect(normalizeHeader("Roll No.")).toBe("roll_no");
    expect(normalizeHeader("﻿Registration  Number ")).toBe("registration_number");
    expect(normalizeHeader("theory_marks")).toBe("theory_marks");
  });
});

describe("parseSpreadsheet", () => {
  it("parses CSV with BOM, quotes and blank lines", async () => {
    const res = await parseSpreadsheet("r.csv", enc('﻿Roll No,Name\n200001,"Khan, A"\n\n200002,B\n'));
    expect(res).toEqual({ headers: ["roll_no", "name"], rows: [{ roll_no: "200001", name: "Khan, A" }, { roll_no: "200002", name: "B" }] });
  });

  it("rejects unsupported extensions, including legacy .xls", async () => {
    expect(await parseSpreadsheet("r.xls", enc("x"))).toEqual({ error: expect.stringContaining("Unsupported file type") });
    expect(await parseSpreadsheet("r.pdf", enc("x"))).toEqual({ error: expect.stringContaining("Unsupported file type") });
  });

  it("rejects empty and oversized files", async () => {
    expect(await parseSpreadsheet("r.csv", new Uint8Array())).toEqual({ error: "The file is empty." });
    expect(await parseSpreadsheet("r.csv", new Uint8Array(MAX_IMPORT_BYTES + 1))).toEqual({ error: "The file is larger than 4 MB." });
  });

  it("rejects a renamed non-xlsx file by magic bytes", async () => {
    expect(await parseSpreadsheet("r.xlsx", enc("roll_no,name\n1,a"))).toEqual({ error: "The file is not a valid .xlsx workbook." });
  });

  it("rejects non UTF-8 CSV", async () => {
    expect(await parseSpreadsheet("r.csv", new Uint8Array([0x72, 0x6f, 0xff, 0xfe, 0x0a]))).toEqual({ error: expect.stringContaining("UTF-8") });
  });

  it("rejects duplicate headers and header-only files", async () => {
    expect(await parseSpreadsheet("r.csv", enc("roll_no,Roll No\n1,2"))).toEqual({ error: expect.stringContaining("more than once") });
    expect(await parseSpreadsheet("r.csv", enc("roll_no,name\n"))).toEqual({ error: "The file contains no data rows." });
  });

  it("round-trips an xlsx workbook including numeric and date cells", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Results");
    ws.addRow(["roll_no", "theory_marks", "date_of_birth", "name"]);
    ws.addRow([200001, 45.5, new Date("2004-05-17T00:00:00Z"), { richText: [{ text: "Rich " }, { text: "Text" }] }]);
    ws.addRow([]);
    const bytes = new Uint8Array(await wb.xlsx.writeBuffer());
    const res = await parseSpreadsheet("r.xlsx", bytes);
    expect(res).toEqual({ headers: ["roll_no", "theory_marks", "date_of_birth", "name"], rows: [{ roll_no: "200001", theory_marks: "45.5", date_of_birth: "2004-05-17", name: "Rich Text" }] });
  });

  it("reads back the generated template format", async () => {
    const buf = await toXlsx([{ name: "S", headers: ["roll_no", "remarks"], rows: [["000123", "x"]], textColumns: ["roll_no"] }]);
    const res = await parseSpreadsheet("t.xlsx", new Uint8Array(buf));
    expect(res).toEqual({ headers: ["roll_no", "remarks"], rows: [{ roll_no: "000123", remarks: "x" }] });
  });
});

describe("checkColumns", () => {
  it("reports missing required and unknown columns", () => {
    expect(checkColumns(["roll_no", "extra"], ["roll_no", "exam_code"], ["roll_no", "exam_code"])).toEqual({ missing: ["exam_code"], unknown: ["extra"] });
  });
});

describe("CSV export safety", () => {
  it("neutralizes spreadsheet formula injection", () => {
    expect(csvSafe("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(csvSafe("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvSafe("normal")).toBe("normal");
    expect(toCsv(["a"], [["=1+1"]])).toContain("'=1+1");
  });
});
