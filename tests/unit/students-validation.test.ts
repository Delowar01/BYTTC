import { describe, expect, it } from "vitest";
import { validDate, validateStudentRows, type StudentLookup } from "@/lib/import/students";

const lookup = (tenant: string | null = null): StudentLookup => ({
  institutes: new Map([
    ["INS-A", { id: "i1", status: "approved" }],
    ["INS-B", { id: "i2", status: "approved" }],
    ["INS-S", { id: "i3", status: "suspended" }],
  ]),
  courses: new Map([
    ["COA", { id: "c1" }],
    ["GD", { id: "c2" }],
  ]),
  sessions: new Map([["january–june 2026", { id: "ss1" }]]),
  assignments: new Set(["i1:c1", "i2:c1"]),
  usedRolls: new Set(["200001"]),
  usedRegistrations: new Set(["2600000001"]),
  tenantInstituteId: tenant,
});
const row = (o: Partial<Record<string, string>> = {}) => ({ institute_code: "INS-A", course_code: "COA", session: "January–June 2026", name_en: "Test Student", ...o });
const msgs = (rows: Record<string, string>[], tenant: string | null = null) => validateStudentRows(rows, lookup(tenant)).issues.map((i) => `${i.row}:${i.column}:${i.message}`);

describe("validDate", () => {
  it("accepts real past dates only", () => {
    expect(validDate("2004-02-29")).toBe(true);
    expect(validDate("2003-02-29")).toBe(false);
    expect(validDate("17/05/2004")).toBe(false);
    expect(validDate("2999-01-01")).toBe(false);
  });
});

describe("validateStudentRows", () => {
  it("accepts a minimal row, leaving identifiers to be generated", () => {
    const res = validateStudentRows([row()], lookup());
    expect(res.errorRows).toBe(0);
    expect(res.valid[0]).toMatchObject({ institute_id: "i1", course_id: "c1", session_id: "ss1", roll_no: null, registration_no: null, name_en: "Test Student" });
  });

  it("matches session names case-insensitively", () => {
    expect(validateStudentRows([row({ session: "JANUARY–JUNE 2026" })], lookup()).errorRows).toBe(0);
  });

  it("rejects unknown references and unapproved institutes", () => {
    const m = msgs([row({ institute_code: "X", course_code: "Y", session: "Z" }), row({ institute_code: "INS-S" })]);
    expect(m).toEqual(expect.arrayContaining(["2:institute_code:Unknown institute code", "2:course_code:Unknown course code", "2:session:Unknown session name", "3:institute_code:Institute is suspended, not approved"]));
  });

  it("enforces tenant isolation for institute users", () => {
    expect(msgs([row({ institute_code: "INS-B" })], "i1")).toContain("2:institute_code:You can only import students of your own institute");
    expect(msgs([row()], "i1")).toEqual([]);
  });

  it("rejects courses not assigned to the institute", () => {
    expect(msgs([row({ course_code: "GD" })])).toContain("2:course_code:Course GD is not assigned to institute INS-A");
  });

  it("rejects identifiers already used in the database or duplicated in the file", () => {
    const m = msgs([row({ roll_no: "200001" }), row({ registration_no: "2600000001" }), row({ roll_no: "R-1" }), row({ roll_no: "r-1" })]);
    expect(m).toEqual(
      expect.arrayContaining([
        "2:roll_no:Roll number is already assigned to another student",
        "3:registration_no:Registration number is already assigned",
        "5:roll_no:Duplicate roll number (also on row 4)",
      ]),
    );
  });

  it("accepts optional thana, district, passport and passing year, validating their format", () => {
    const ok = validateStudentRows([row({ thana: "Sonaimuri", district: "Noakhali", passport_no: "a1 234567", passing_year: "2019" })], lookup());
    expect(ok.errorRows).toBe(0);
    expect(ok.valid[0]).toMatchObject({ thana: "Sonaimuri", district: "Noakhali", passport_no: "A1234567", passing_year: 2019 });
    const m = msgs([row({ passport_no: "X1" }), row({ passport_no: "B7654321" }), row({ passport_no: "B7654321" }), row({ passing_year: "19" })]);
    expect(m).toEqual(expect.arrayContaining(["2:passport_no:Passport number: 5–20 letters or digits", "4:passport_no:Duplicate passport number (also on row 3)", "5:passing_year:Use a 4-digit year"]));
  });

  it("validates name, date of birth, gender and email", () => {
    const m = msgs([row({ name_en: "A", date_of_birth: "2004-13-01", gender: "x", email: "bad@" })]);
    expect(m).toEqual(
      expect.arrayContaining([
        "2:name_en:Name (English) must be 2–120 characters",
        "2:date_of_birth:Use YYYY-MM-DD (a real past date)",
        "2:gender:Use male, female or other",
        "2:email:Invalid email address",
      ]),
    );
  });
});
