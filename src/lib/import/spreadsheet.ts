import ExcelJS from "exceljs";
import Papa from "papaparse";

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
export const MAX_IMPORT_ROWS = 20_000;

export type ParsedSheet = { headers: string[]; rows: Record<string, string>[] };
export type ParseResult = ParsedSheet | { error: string };

/** "Roll No." → "roll_no" so headers are matched leniently. */
export function normalizeHeader(h: string) {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return cellToString(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("error" in value) return "";
  }
  return String(value);
}

function finish(headers: string[], rows: Record<string, string>[]): ParseResult {
  if (headers.length === 0 || headers.every((h) => h === "")) return { error: "The file has no header row." };
  const seen = new Set<string>();
  for (const h of headers) {
    if (h && seen.has(h)) return { error: `Column "${h}" appears more than once.` };
    seen.add(h);
  }
  if (rows.length === 0) return { error: "The file contains no data rows." };
  if (rows.length > MAX_IMPORT_ROWS) return { error: `The file has ${rows.length} rows; the maximum is ${MAX_IMPORT_ROWS}. Split it into smaller files.` };
  return { headers, rows };
}

export async function parseSpreadsheet(name: string, bytes: Uint8Array): Promise<ParseResult> {
  if (bytes.byteLength === 0) return { error: "The file is empty." };
  if (bytes.byteLength > MAX_IMPORT_BYTES) return { error: "The file is larger than 4 MB." };
  const lower = name.toLowerCase();

  if (lower.endsWith(".xlsx")) {
    // XLSX files are ZIP containers: "PK\x03\x04"
    if (!(bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04)) {
      return { error: "The file is not a valid .xlsx workbook." };
    }
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    } catch {
      return { error: "The workbook could not be read. Save it again as .xlsx and retry." };
    }
    const ws = wb.worksheets[0];
    if (!ws) return { error: "The workbook has no worksheets." };
    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    for (let c = 1; c <= headerRow.cellCount; c++) headers.push(normalizeHeader(cellToString(headerRow.getCell(c).value)));
    while (headers.length && headers[headers.length - 1] === "") headers.pop();
    const rows: Record<string, string>[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const rec: Record<string, string> = {};
      let empty = true;
      headers.forEach((h, i) => {
        if (!h) return;
        const v = cellToString(row.getCell(i + 1).value).trim();
        if (v !== "") empty = false;
        rec[h] = v;
      });
      if (!empty) rows.push(rec);
      if (rows.length > MAX_IMPORT_ROWS) break;
    }
    return finish(headers, rows);
  }

  if (lower.endsWith(".csv")) {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return { error: "The CSV file is not UTF-8 encoded. In Excel use “CSV UTF-8” when saving." };
    }
    if (text.includes("\u0000")) return { error: "The file is not a text CSV file." };
    const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: "greedy" });
    if (result.errors.length) {
      const e = result.errors[0];
      return { error: `CSV format error near row ${(e.row ?? 0) + 1}: ${e.message}` };
    }
    const [head, ...body] = result.data;
    const headers = (head ?? []).map(normalizeHeader);
    const rows = body.map((cells) => {
      const rec: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) rec[h] = (cells[i] ?? "").trim();
      });
      return rec;
    });
    return finish(headers, rows);
  }

  return { error: "Unsupported file type. Upload an Excel .xlsx or a .csv file." };
}

export function checkColumns(headers: string[], required: readonly string[], known: readonly string[]) {
  return {
    missing: required.filter((c) => !headers.includes(c)),
    unknown: headers.filter((h) => h && !known.includes(h)),
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Prevent spreadsheet formula injection in CSV exports (OWASP). */
export function csvSafe(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return "﻿" + Papa.unparse({ fields: headers, data: rows.map((r) => r.map(csvSafe)) });
}

export type SheetSpec = { name: string; headers: string[]; rows: unknown[][]; textColumns?: string[]; widths?: number[] };

export async function toXlsx(sheets: SheetSpec[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  for (const spec of sheets) {
    const ws = wb.addWorksheet(spec.name);
    ws.columns = spec.headers.map((h, i) => ({
      header: h,
      key: h,
      width: spec.widths?.[i] ?? Math.max(12, h.length + 4),
      style: spec.textColumns?.includes(h) ? { numFmt: "@" } : undefined,
    }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of spec.rows) ws.addRow(r.map((v) => (v === null || v === undefined ? "" : v)));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
