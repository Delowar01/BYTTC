import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Session } from "@/lib/auth";
import { isCentral } from "@/lib/roles";
import { checkColumns, parseSpreadsheet } from "./spreadsheet";
import { RESULT_COLUMNS, RESULT_REQUIRED, validateResultRows } from "./results";
import { STUDENT_COLUMNS, STUDENT_REQUIRED, validateStudentRows } from "./students";
import { loadResultLookup, loadStudentLookup } from "./load";

export type StageOutcome = { batchId: string } | { error: string };

const CONTENT_TYPES: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

/**
 * Validate an uploaded file and stage it as an import batch (status
 * "validated"). Nothing is written to students/results until the batch is
 * explicitly committed; results are then created as drafts.
 */
export async function stageImport(kind: "results" | "students", session: Session, file: FormDataEntryValue | null): Promise<StageOutcome> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a .xlsx or .csv file to upload." };
  const { supabase, profile } = session;
  const tenantId = isCentral(profile.role) ? null : profile.institute_id;
  if (!isCentral(profile.role) && !tenantId) return { error: "Your account is not linked to an institute." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parseSpreadsheet(file.name, bytes);
  if ("error" in parsed) return { error: parsed.error };

  const required = kind === "results" ? RESULT_REQUIRED : STUDENT_REQUIRED;
  const known = kind === "results" ? RESULT_COLUMNS : STUDENT_COLUMNS;
  const cols = checkColumns(parsed.headers, required, known);
  if (cols.missing.length) {
    return { error: `Missing required column(s): ${cols.missing.join(", ")}. Download the template for the expected format.` };
  }

  const { valid, issues, errorRows } =
    kind === "results"
      ? validateResultRows(parsed.rows, await loadResultLookup(supabase, parsed.rows))
      : validateStudentRows(parsed.rows, await loadStudentLookup(supabase, parsed.rows, tenantId));

  const warnings = cols.unknown.map((c) => ({ row: 1, column: c, message: "Unknown column ignored", level: "warning" as const }));
  const batchId = randomUUID();
  const ext = file.name.toLowerCase().endsWith(".xlsx") ? "xlsx" : "csv";
  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80);
  const path = `${tenantId ? `institutes/${tenantId}/` : ""}imports/${batchId}/${safe}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const upload = await supabase.storage.from("private-documents").upload(path, bytes, { contentType: CONTENT_TYPES[ext] });
  if (upload.error) return { error: `Could not store the file: ${upload.error.message}` };

  const summary: Record<string, number> = {};
  if (kind === "results") for (const v of valid as { exam_code: string }[]) summary[v.exam_code] = (summary[v.exam_code] ?? 0) + 1;

  const { error } = await supabase.from("import_batches").insert({
    id: batchId,
    kind,
    status: "validated",
    file_name: file.name.slice(0, 200),
    file_size: file.size,
    file_sha256: sha256,
    file_path: path,
    institute_id: tenantId,
    total_rows: parsed.rows.length,
    valid_rows: valid.length,
    error_rows: errorRows,
    errors: [...warnings, ...issues],
    payload: valid,
    summary: { by_exam: summary },
  });
  if (error) return { error: `Could not create the import batch: ${error.message}` };
  return { batchId };
}
