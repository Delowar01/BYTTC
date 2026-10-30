/**
 * Regenerate the sample import files in samples/ (synthetic data matching
 * supabase/seed.sql).   npx tsx scripts/make-samples.ts
 */
import ExcelJS from "exceljs";

const RESULT_HEADERS = ["roll_no", "registration_no", "student_name", "institute_code", "course_code", "exam_code", "theory_marks", "practical_marks", "remarks"];
const STUDENT_HEADERS = ["institute_code", "course_code", "session", "roll_no", "registration_no", "name_en", "name_bn", "father_name", "mother_name", "date_of_birth", "gender", "phone", "email", "address"];

async function write(file: string, headers: string[], rows: (string | number)[][], note: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Data");
  ws.columns = headers.map((h) => ({ header: h, key: h, width: Math.max(14, h.length + 4), style: { numFmt: "@" } }));
  ws.getRow(1).font = { bold: true };
  rows.forEach((r) => ws.addRow(r));
  const info = wb.addWorksheet("About");
  info.getColumn(1).width = 110;
  note.split("\n").forEach((line) => info.addRow([line]));
  await wb.xlsx.writeFile(file);
  console.log(`✔ ${file}`);
}

async function main() {
  // Seed students enrolled in course COA, session July–December 2026.
  const valid = [
    ["200045", "2600000045", "Arif Chowdhury", "DHK-001", "COA", "COA-2026-DEC", 52, 31, ""],
    ["200046", "2600000046", "Sadia Sarkar", "CTG-001", "COA", "COA-2026-DEC", 47.5, 28, ""],
    ["200047", "2600000047", "Tanvir Das", "RAJ-001", "COA", "COA-2026-DEC", 15, 10, "Below pass mark"],
    ["200054", "2600000054", "Tania Khan", "DHK-001", "COA", "COA-2026-DEC", 58, 38, ""],
    ["200055", "2600000055", "Fahim Chowdhury", "CTG-001", "COA", "COA-2026-DEC", 36, 22, ""],
    ["200056", "2600000056", "Ruma Sarkar", "RAJ-001", "COA", "COA-2026-DEC", 44, 30, ""],
  ];
  await write("samples/results-import-valid.xlsx", RESULT_HEADERS, valid,
    "SYNTHETIC TEST DATA — matches supabase/seed.sql. Do not use with real student records.\n" +
    "Expected: 6 valid rows, 0 errors. Commit saves 6 DRAFT results for exam COA-2026-DEC (theory /60, practical /40, pass 40).\n" +
    "Expected grades after publishing: 200045 A+, 200046 A, 200047 F (fail), 200054 A+, 200055 B, 200056 A.");

  const withErrors = [
    ["200045", "2600000045", "Arif Chowdhury", "DHK-001", "COA", "COA-2026-DEC", 52, 31, ""],
    ["200046", "2600000046", "Sadia Sarkar", "CTG-001", "COA", "COA-2026-DEC", 75, 28, "theory above full marks"],
    ["200047", "9999999999", "Tanvir Das", "RAJ-001", "COA", "COA-2026-DEC", 40, 20, "wrong registration number"],
    ["200045", "2600000045", "Arif Chowdhury", "DHK-001", "COA", "COA-2026-DEC", 50, 30, "duplicate row"],
    ["999999", "2699999999", "Unknown Student", "DHK-001", "COA", "COA-2026-DEC", 40, 20, "unknown roll"],
    ["200054", "2600000054", "Tania Khan", "CTG-001", "COA", "COA-2026-DEC", 40, 20, "wrong institute"],
    ["200055", "2600000055", "Fahim Chowdhury", "CTG-001", "COA", "NO-SUCH-EXAM", 40, 20, "unknown exam"],
  ];
  await write("samples/results-import-with-errors.xlsx", RESULT_HEADERS, withErrors,
    "SYNTHETIC TEST DATA. Demonstrates validation: expected 1 valid row and 6 rows with errors; the batch cannot be committed.");

  const students = [
    ["DHK-001", "COA", "July–December 2026", "", "", "Test Student One", "পরীক্ষা শিক্ষার্থী এক", "Test Father", "Test Mother", "2005-02-14", "female", "+880 1900-000101", "", "Dhaka"],
    ["DHK-001", "COA", "July–December 2026", "", "", "Test Student Two", "", "Test Father", "Test Mother", "2004-09-30", "male", "+880 1900-000102", "", "Dhaka"],
    ["CTG-001", "WEB", "July–December 2026", "", "", "Test Student Three", "", "", "", "2006-01-05", "other", "", "", "Chattogram"],
  ];
  await write("samples/students-import-sample.xlsx", STUDENT_HEADERS, students,
    "SYNTHETIC TEST DATA. Expected: 3 valid rows; roll and registration numbers are generated on commit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
