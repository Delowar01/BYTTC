/**
 * Pure validation for bulk result uploads. No I/O: the caller loads the
 * lookups (students by roll, institutes, courses, exams, existing results)
 * using the signed-in user's RLS-scoped client, so tenants can only match
 * their own students.
 */

export const RESULT_REQUIRED = [
  "roll_no",
  "registration_no",
  "institute_code",
  "course_code",
  "exam_code",
  "theory_marks",
  "practical_marks",
] as const;
export const RESULT_COLUMNS = [
  "roll_no",
  "registration_no",
  "student_name",
  "institute_code",
  "course_code",
  "exam_code",
  "theory_marks",
  "practical_marks",
  "remarks",
] as const;

export type ImportIssue = { row: number; column?: string; value?: string; message: string; level: "error" | "warning" };

export type ResultLookup = {
  students: Map<string, { id: string; registration_no: string; name_en: string; institute_id: string; course_id: string }>;
  institutes: Map<string, { id: string; status: string }>;
  courses: Map<string, { id: string }>;
  exams: Map<string, { id: string; course_id: string; theory_full_marks: number; practical_full_marks: number; is_active: boolean }>;
  /** `${student_id}:${exam_id}` → current result status */
  existing: Map<string, string>;
};

export type ResultPayloadRow = {
  row: number;
  student_id: string;
  exam_id: string;
  theory_marks: number | null;
  practical_marks: number | null;
  remarks: string | null;
  roll_no: string;
  exam_code: string;
  student_name: string;
};

export const normId = (v: string | undefined) => (v ?? "").trim().toUpperCase();

/** Parse a marks cell: number, ≥ 0, ≤ full marks, at most 2 decimals. */
export function parseMarks(raw: string | undefined, full: number): { value: number | null; error?: string } {
  const s = (raw ?? "").trim();
  if (s === "") return full === 0 ? { value: null } : { value: null, error: "Marks are required" };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { value: null, error: "Must be a number ≥ 0 with at most 2 decimals" };
  const n = Number(s);
  if (n > full) return { value: null, error: `Exceeds full marks (${full})` };
  return { value: n };
}

export function validateResultRows(rows: Record<string, string>[], lookup: ResultLookup) {
  const issues: ImportIssue[] = [];
  const valid: ResultPayloadRow[] = [];
  const seenRollExam = new Map<string, number>();
  const seenRegRoll = new Map<string, string>();

  rows.forEach((r, i) => {
    const rowNo = i + 2; // spreadsheet row (row 1 = header)
    const rowIssues: ImportIssue[] = [];
    const err = (column: string, message: string, value?: string) =>
      rowIssues.push({ row: rowNo, column, value, message, level: "error" });

    const roll = normId(r.roll_no);
    const reg = normId(r.registration_no);
    const instCode = normId(r.institute_code);
    const courseCode = normId(r.course_code);
    const examCode = normId(r.exam_code);

    if (!roll) err("roll_no", "Roll number is required");
    if (!reg) err("registration_no", "Registration number is required");
    if (!instCode) err("institute_code", "Institute code is required");
    if (!courseCode) err("course_code", "Course code is required");
    if (!examCode) err("exam_code", "Exam code is required");

    // Duplicate identifiers inside the same file
    if (roll && examCode) {
      const key = `${roll}|${examCode}`;
      const first = seenRollExam.get(key);
      if (first) err("roll_no", `Duplicate: roll ${roll} already appears for exam ${examCode} on row ${first}`, roll);
      else seenRollExam.set(key, rowNo);
    }
    if (reg && roll) {
      const otherRoll = seenRegRoll.get(reg);
      if (otherRoll && otherRoll !== roll) err("registration_no", `Registration ${reg} is used with a different roll (${otherRoll}) in this file`, reg);
      else seenRegRoll.set(reg, roll);
    }

    const student = roll ? lookup.students.get(roll) : undefined;
    if (roll && !student) err("roll_no", "No student with this roll number (or not in your institute)", roll);
    if (student && reg && student.registration_no !== reg) err("registration_no", "Registration number does not match the student's record", reg);

    const institute = instCode ? lookup.institutes.get(instCode) : undefined;
    if (instCode && !institute) err("institute_code", "Unknown institute code", instCode);
    else if (institute && institute.status !== "approved") err("institute_code", `Institute is ${institute.status}, not approved`, instCode);
    if (student && institute && student.institute_id !== institute.id) err("institute_code", "Student is not registered at this institute", instCode);

    const course = courseCode ? lookup.courses.get(courseCode) : undefined;
    if (courseCode && !course) err("course_code", "Unknown course code", courseCode);
    if (student && course && student.course_id !== course.id) err("course_code", "Student is not enrolled in this course", courseCode);

    const exam = examCode ? lookup.exams.get(examCode) : undefined;
    if (examCode && !exam) err("exam_code", "Unknown exam code", examCode);
    else if (exam && !exam.is_active) err("exam_code", "Exam is inactive", examCode);
    if (exam && course && exam.course_id !== course.id) err("exam_code", "Exam does not belong to this course", examCode);

    let theory: number | null = null;
    let practical: number | null = null;
    if (exam) {
      const t = parseMarks(r.theory_marks, Number(exam.theory_full_marks));
      if (t.error) err("theory_marks", t.error, r.theory_marks);
      theory = t.value;
      const p = parseMarks(r.practical_marks, Number(exam.practical_full_marks));
      if (p.error) err("practical_marks", p.error, r.practical_marks);
      practical = p.value;
    }

    if (student && exam) {
      const status = lookup.existing.get(`${student.id}:${exam.id}`);
      if (status) err("roll_no", `A ${status} result already exists for this student and exam; use correction instead`, roll);
    }

    const name = (r.student_name ?? "").trim();
    if (student && name && name.toLowerCase() !== student.name_en.toLowerCase()) {
      rowIssues.push({ row: rowNo, column: "student_name", value: name, message: `Name differs from record (“${student.name_en}”)`, level: "warning" });
    }
    const remarks = (r.remarks ?? "").trim();
    if (remarks.length > 500) err("remarks", "Remarks must be at most 500 characters");

    issues.push(...rowIssues);
    if (!rowIssues.some((x) => x.level === "error") && student && exam) {
      valid.push({
        row: rowNo,
        student_id: student.id,
        exam_id: exam.id,
        theory_marks: theory,
        practical_marks: practical,
        remarks: remarks || null,
        roll_no: roll,
        exam_code: examCode,
        student_name: student.name_en,
      });
    }
  });

  const errorRows = new Set(issues.filter((x) => x.level === "error").map((x) => x.row)).size;
  return { valid, issues, errorRows };
}
