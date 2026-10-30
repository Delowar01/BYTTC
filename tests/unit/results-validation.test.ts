import { describe, expect, it } from "vitest";
import { parseMarks, validateResultRows, type ResultLookup } from "@/lib/import/results";

const lookup = (): ResultLookup => ({
  students: new Map([
    ["100001", { id: "s1", registration_no: "2600000001", name_en: "Asha Khan", institute_id: "i1", course_id: "c1" }],
    ["100002", { id: "s2", registration_no: "2600000002", name_en: "Babu Das", institute_id: "i1", course_id: "c1" }],
    ["100003", { id: "s3", registration_no: "2600000003", name_en: "Chandni Roy", institute_id: "i2", course_id: "c2" }],
  ]),
  institutes: new Map([
    ["INS-A", { id: "i1", status: "approved" }],
    ["INS-B", { id: "i2", status: "approved" }],
    ["INS-P", { id: "i3", status: "pending" }],
  ]),
  courses: new Map([
    ["COA", { id: "c1" }],
    ["GD", { id: "c2" }],
  ]),
  exams: new Map([
    ["COA-1", { id: "e1", course_id: "c1", theory_full_marks: 60, practical_full_marks: 40, is_active: true }],
    ["GD-1", { id: "e2", course_id: "c2", theory_full_marks: 100, practical_full_marks: 0, is_active: true }],
    ["OLD", { id: "e3", course_id: "c1", theory_full_marks: 60, practical_full_marks: 40, is_active: false }],
  ]),
  existing: new Map([["s2:e1", "published"]]),
});

const row = (o: Partial<Record<string, string>> = {}) => ({
  roll_no: "100001",
  registration_no: "2600000001",
  institute_code: "INS-A",
  course_code: "COA",
  exam_code: "COA-1",
  theory_marks: "50",
  practical_marks: "30",
  ...o,
});

const messages = (rows: Record<string, string>[]) => validateResultRows(rows, lookup()).issues.map((i) => `${i.row}:${i.column}:${i.message}`);

describe("parseMarks", () => {
  it("accepts numbers within range with up to 2 decimals", () => {
    expect(parseMarks("45.25", 60)).toEqual({ value: 45.25 });
    expect(parseMarks("0", 60)).toEqual({ value: 0 });
    expect(parseMarks("60", 60)).toEqual({ value: 60 });
  });
  it("rejects invalid, negative, too precise and out-of-range marks", () => {
    expect(parseMarks("abc", 60).error).toMatch(/number/);
    expect(parseMarks("-1", 60).error).toMatch(/number/);
    expect(parseMarks("10.123", 60).error).toMatch(/decimals/);
    expect(parseMarks("60.5", 60).error).toMatch(/Exceeds full marks/);
    expect(parseMarks("", 60).error).toMatch(/required/);
  });
  it("allows blank marks when the component has zero full marks", () => {
    expect(parseMarks("", 0)).toEqual({ value: null });
  });
});

describe("validateResultRows", () => {
  it("accepts a valid row and maps it to ids", () => {
    const res = validateResultRows([row()], lookup());
    expect(res.errorRows).toBe(0);
    expect(res.valid).toEqual([{ row: 2, student_id: "s1", exam_id: "e1", theory_marks: 50, practical_marks: 30, remarks: null, roll_no: "100001", exam_code: "COA-1", student_name: "Asha Khan" }]);
  });

  it("normalizes case and whitespace of identifiers", () => {
    const res = validateResultRows([row({ institute_code: " ins-a ", course_code: "coa", exam_code: "coa-1" })], lookup());
    expect(res.errorRows).toBe(0);
  });

  it("flags missing required values", () => {
    expect(messages([row({ roll_no: "", exam_code: "" })])).toEqual(expect.arrayContaining(["2:roll_no:Roll number is required", "2:exam_code:Exam code is required"]));
  });

  it("flags unknown student and registration mismatch", () => {
    expect(messages([row({ roll_no: "999999" })])).toContain("2:roll_no:No student with this roll number (or not in your institute)");
    expect(messages([row({ registration_no: "2600000009" })])).toContain("2:registration_no:Registration number does not match the student's record");
  });

  it("flags institute problems: unknown, not approved, wrong institute", () => {
    expect(messages([row({ institute_code: "NOPE" })])).toContain("2:institute_code:Unknown institute code");
    expect(messages([row({ institute_code: "INS-P" })])).toContain("2:institute_code:Institute is pending, not approved");
    expect(messages([row({ institute_code: "INS-B" })])).toContain("2:institute_code:Student is not registered at this institute");
  });

  it("flags course and exam problems", () => {
    expect(messages([row({ course_code: "GD" })])).toContain("2:course_code:Student is not enrolled in this course");
    expect(messages([row({ exam_code: "NOPE" })])).toContain("2:exam_code:Unknown exam code");
    expect(messages([row({ exam_code: "OLD" })])).toContain("2:exam_code:Exam is inactive");
    expect(messages([row({ exam_code: "GD-1" })])).toContain("2:exam_code:Exam does not belong to this course");
  });

  it("flags out-of-range marks against the exam's full marks", () => {
    expect(messages([row({ theory_marks: "61" })])).toContain("2:theory_marks:Exceeds full marks (60)");
    expect(messages([row({ practical_marks: "x" })])).toContain("2:practical_marks:Must be a number ≥ 0 with at most 2 decimals");
  });

  it("flags duplicates within the file and conflicting registration numbers", () => {
    const res = messages([row(), row(), row({ roll_no: "100002", registration_no: "2600000001" })]);
    expect(res).toContain("3:roll_no:Duplicate: roll 100001 already appears for exam COA-1 on row 2");
    expect(res).toContain("4:registration_no:Registration 2600000001 is used with a different roll (100001) in this file");
  });

  it("flags results that already exist in the database", () => {
    expect(messages([row({ roll_no: "100002", registration_no: "2600000002" })])).toContain(
      "2:roll_no:A published result already exists for this student and exam; use correction instead",
    );
  });

  it("treats a student-name mismatch as a warning, not an error", () => {
    const res = validateResultRows([row({ student_name: "Someone Else" })], lookup());
    expect(res.errorRows).toBe(0);
    expect(res.valid).toHaveLength(1);
    expect(res.issues).toEqual([expect.objectContaining({ level: "warning", column: "student_name" })]);
  });

  it("counts rows (not issues) with errors and excludes them from the payload", () => {
    const res = validateResultRows([row(), row({ roll_no: "999", registration_no: "", theory_marks: "x" })], lookup());
    expect(res.errorRows).toBe(1);
    expect(res.valid.map((v) => v.row)).toEqual([2]);
  });
});
