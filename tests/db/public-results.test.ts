import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, dbAvailable, IDS, service, SUPER, type Client } from "./helpers";

describe.skipIf(!dbAvailable)("Public result lookup v2 and result verification", () => {
  let admin: Client;
  const db = service();
  const passport = `PT${Date.now().toString(36).toUpperCase()}`.slice(0, 14);
  let student: { id: string; roll_no: string; registration_no: string };
  let examId = "";
  let resultId = "";
  let verifyCode = "";

  beforeAll(async () => {
    admin = await as(SUPER);
    const { data: s } = await admin.from("students").select("id, roll_no, registration_no").eq("course_id", IDS.coa).eq("institute_id", IDS.ctg).order("roll_no").limit(1).single();
    student = s!;
    await admin.from("students").update({ passport_no: passport, father_name: "Lookup Father", date_of_birth: "2004-01-02" }).eq("id", student.id);
    const { data: e } = await admin.from("exams").insert({ code: `PL-${Date.now().toString(36).toUpperCase()}`, name: "Lookup exam", course_id: IDS.coa, session_id: IDS.sessionJul, theory_full_marks: 100, practical_full_marks: 50, viva_full_marks: 50, pass_marks: 80, grade_scale_code: "GPA4" }).select("id").single();
    examId = e!.id;
    const { data: r } = await admin.from("results").insert({ exam_id: examId, student_id: student.id, institute_id: IDS.ctg, theory_marks: 90, practical_marks: 40, viva_marks: 30 }).select("id, verify_code").single();
    resultId = r!.id;
    verifyCode = r!.verify_code;
  });

  afterAll(async () => {
    await db.from("site_settings").update({ public_show_photo: false, public_show_parents: false, public_show_dob: false }).eq("id", 1);
    await db.from("students").update({ passport_no: null }).eq("id", student.id);
    await db.from("results").delete().eq("id", resultId);
    await db.from("exams").delete().eq("id", examId);
  });

  const lookup = (method: string, a: string, b: string) => db.rpc("public_result_lookup_v2", { p_method: method, p_first: a, p_second: b });

  it("verification of a never-published result finds nothing", async () => {
    const { data } = await db.rpc("public_verify_result", { p_code: verifyCode, p_version: 1 });
    expect(data).toHaveLength(0);
  });

  it("finds published results with any two matching identifiers — never with one", async () => {
    expect((await lookup("roll_reg", student.roll_no, student.registration_no)).data!.map((r) => r.exam_name)).not.toContain("Lookup exam"); // draft
    await admin.rpc("set_results_publication", { p_ids: [resultId], p_publish: true });
    for (const [m, a, b] of [
      ["roll_reg", student.roll_no, student.registration_no],
      ["passport_roll", passport.toLowerCase(), student.roll_no],
      ["passport_reg", ` ${passport} `, student.registration_no],
    ]) {
      const { data, error } = await lookup(m, a, b);
      expect(error, m).toBeNull();
      const row = data!.find((r) => r.exam_name === "Lookup exam");
      expect(row, m).toMatchObject({ total_marks: 160, full_marks: 200, viva_marks: 30, grade: "A+", grade_point: 4, scale_max_point: 4 });
      expect(JSON.stringify(row)).not.toContain(passport);
    }
    for (const [m, a, b] of [
      ["passport_roll", passport, "000000"],
      ["passport_reg", passport, ""],
      ["passport_roll", "WRONG12345", student.roll_no],
      ["roll_reg", student.roll_no, "2699999999"],
      ["bogus", student.roll_no, student.registration_no],
    ]) {
      expect((await lookup(m, a, b)).data, `${m} ${a} ${b}`).toHaveLength(0);
    }
  });

  it("is not callable by anonymous clients (server-only, rate limited)", async () => {
    expect((await anon().rpc("public_result_lookup_v2", { p_method: "roll_reg", p_first: student.roll_no, p_second: student.registration_no })).error?.message).toMatch(/permission denied/);
    expect((await anon().rpc("public_verify_result", { p_code: verifyCode, p_version: 1 })).error?.message).toMatch(/permission denied/);
  });

  it("hides personal details unless the privacy settings allow them", async () => {
    const hidden = (await lookup("roll_reg", student.roll_no, student.registration_no)).data!.find((r) => r.exam_name === "Lookup exam")!;
    expect(hidden).toMatchObject({ father_name: null, mother_name: null, date_of_birth: null, photo_path: null });
    await admin.from("site_settings").update({ public_show_parents: true, public_show_dob: true }).eq("id", 1);
    const shown = (await lookup("roll_reg", student.roll_no, student.registration_no)).data!.find((r) => r.exam_name === "Lookup exam")!;
    expect(shown).toMatchObject({ father_name: "Lookup Father", date_of_birth: "2004-01-02" });
  });

  it("verifies result sheets: valid, superseded after a correction, withdrawn when unpublished", async () => {
    expect((await db.rpc("public_verify_result", { p_code: verifyCode.toLowerCase(), p_version: 1 })).data![0]).toMatchObject({ status: "valid", grade: "A+", current_version: 1 });
    await admin.rpc("correct_result_v2", { p_id: resultId, p_theory: 80, p_practical: 40, p_viva: 30, p_remarks: "", p_display_published_on: null as never, p_grade_override: "", p_grade_point_override: null as never, p_reason: "Recheck" });
    expect((await db.rpc("public_verify_result", { p_code: verifyCode, p_version: 1 })).data![0]).toMatchObject({ status: "superseded", current_version: 2 });
    expect((await db.rpc("public_verify_result", { p_code: verifyCode, p_version: 2 })).data![0].status).toBe("valid");
    await admin.rpc("set_results_publication", { p_ids: [resultId], p_publish: false });
    const withdrawn = (await db.rpc("public_verify_result", { p_code: verifyCode, p_version: 2 })).data![0];
    expect(withdrawn).toMatchObject({ status: "withdrawn", grade: null, total_marks: null });
  });
});
