/** Pure validation for bulk student uploads (see results.ts for conventions). */
import { normId, type ImportIssue } from "./results";

export const STUDENT_REQUIRED = ["institute_code", "course_code", "session", "name_en"] as const;
export const STUDENT_COLUMNS = [
  "institute_code",
  "course_code",
  "session",
  "roll_no",
  "registration_no",
  "name_en",
  "name_bn",
  "father_name",
  "mother_name",
  "date_of_birth",
  "gender",
  "phone",
  "email",
  "address",
] as const;

export type StudentLookup = {
  institutes: Map<string, { id: string; status: string }>;
  courses: Map<string, { id: string }>;
  /** lower-cased session name → id */
  sessions: Map<string, { id: string }>;
  /** `${institute_id}:${course_id}` pairs the institute may enrol in */
  assignments: Set<string>;
  usedRolls: Set<string>;
  usedRegistrations: Set<string>;
  /** Tenant users may only import into their own institute. */
  tenantInstituteId: string | null;
};

export type StudentPayloadRow = {
  row: number;
  institute_id: string;
  course_id: string;
  session_id: string;
  roll_no: string | null;
  registration_no: string | null;
  name_en: string;
  name_bn: string | null;
  father_name: string | null;
  mother_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

const ID_RE = /^[A-Z0-9-]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validDate(s: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && s > "1900-01-01" && d <= new Date();
}

export function validateStudentRows(rows: Record<string, string>[], lookup: StudentLookup) {
  const issues: ImportIssue[] = [];
  const valid: StudentPayloadRow[] = [];
  const seenRoll = new Map<string, number>();
  const seenReg = new Map<string, number>();
  const opt = (v: string | undefined) => (v && v.trim() !== "" ? v.trim() : null);

  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const rowIssues: ImportIssue[] = [];
    const err = (column: string, message: string, value?: string) => rowIssues.push({ row: rowNo, column, value, message, level: "error" });

    const instCode = normId(r.institute_code);
    const courseCode = normId(r.course_code);
    const sessionName = (r.session ?? "").trim();
    const roll = normId(r.roll_no);
    const reg = normId(r.registration_no);
    const name = (r.name_en ?? "").trim();

    const institute = lookup.institutes.get(instCode);
    if (!instCode) err("institute_code", "Institute code is required");
    else if (!institute) err("institute_code", "Unknown institute code", instCode);
    else if (institute.status !== "approved") err("institute_code", `Institute is ${institute.status}, not approved`, instCode);
    else if (lookup.tenantInstituteId && institute.id !== lookup.tenantInstituteId) err("institute_code", "You can only import students of your own institute", instCode);

    const course = lookup.courses.get(courseCode);
    if (!courseCode) err("course_code", "Course code is required");
    else if (!course) err("course_code", "Unknown course code", courseCode);

    if (institute && course && !lookup.assignments.has(`${institute.id}:${course.id}`)) {
      err("course_code", `Course ${courseCode} is not assigned to institute ${instCode}`, courseCode);
    }

    const session = lookup.sessions.get(sessionName.toLowerCase());
    if (!sessionName) err("session", "Session is required");
    else if (!session) err("session", "Unknown session name", sessionName);

    if (name.length < 2 || name.length > 120) err("name_en", "Name (English) must be 2–120 characters", name);

    if (roll) {
      if (!ID_RE.test(roll)) err("roll_no", "3–20 letters, digits or dashes", roll);
      else if (lookup.usedRolls.has(roll)) err("roll_no", "Roll number is already assigned to another student", roll);
      else if (seenRoll.has(roll)) err("roll_no", `Duplicate roll number (also on row ${seenRoll.get(roll)})`, roll);
      else seenRoll.set(roll, rowNo);
    }
    if (reg) {
      if (!ID_RE.test(reg)) err("registration_no", "3–20 letters, digits or dashes", reg);
      else if (lookup.usedRegistrations.has(reg)) err("registration_no", "Registration number is already assigned", reg);
      else if (seenReg.has(reg)) err("registration_no", `Duplicate registration number (also on row ${seenReg.get(reg)})`, reg);
      else seenReg.set(reg, rowNo);
    }

    const dob = (r.date_of_birth ?? "").trim();
    if (dob && !validDate(dob)) err("date_of_birth", "Use YYYY-MM-DD (a real past date)", dob);
    const gender = (r.gender ?? "").trim().toLowerCase();
    if (gender && !["male", "female", "other"].includes(gender)) err("gender", "Use male, female or other", r.gender);
    const email = (r.email ?? "").trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) err("email", "Invalid email address", email);

    issues.push(...rowIssues);
    if (!rowIssues.length && institute && course && session) {
      valid.push({
        row: rowNo,
        institute_id: institute.id,
        course_id: course.id,
        session_id: session.id,
        roll_no: roll || null,
        registration_no: reg || null,
        name_en: name,
        name_bn: opt(r.name_bn),
        father_name: opt(r.father_name),
        mother_name: opt(r.mother_name),
        date_of_birth: dob || null,
        gender: gender || null,
        phone: opt(r.phone),
        email: email || null,
        address: opt(r.address),
      });
    }
  });

  const errorRows = new Set(issues.map((x) => x.row)).size;
  return { valid, issues, errorRows };
}
