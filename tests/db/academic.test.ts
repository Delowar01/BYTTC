import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, CENTRAL_STAFF, dbAvailable, DHK_STAFF, IDS, service, SUPER, type Client } from "./helpers";

const uid = () => Date.now().toString(36).toUpperCase().slice(-6) + Math.random().toString(36).slice(2, 5).toUpperCase();

describe.skipIf(!dbAvailable)("Academic records upgrade (Viva, scales, publication dates, corrections)", () => {
  let admin: Client, staff: Client, dhk: Client;
  const tag = uid();
  const scaleCode = `T${tag}`.slice(0, 20);
  const examIds: string[] = [];
  let students: { id: string; institute_id: string }[] = [];

  async function makeExam(over: Record<string, unknown>) {
    const { data, error } = await admin
      .from("exams")
      .insert({ code: `A-${tag}-${examIds.length}`, name: "Academic test exam", course_id: IDS.coa, session_id: IDS.sessionJul, theory_full_marks: 100, practical_full_marks: 50, viva_full_marks: 50, pass_marks: 80, ...over })
      .select("id")
      .single();
    if (error) throw error;
    examIds.push(data.id);
    return data.id;
  }
  const insert = (exam: string, i: number, t: number, p: number, v: number | null) =>
    admin.from("results").insert({ exam_id: exam, student_id: students[i].id, institute_id: students[i].institute_id, theory_marks: t, practical_marks: p, viva_marks: v }).select("*").single();

  beforeAll(async () => {
    [admin, staff, dhk] = await Promise.all([as(SUPER), as(CENTRAL_STAFF), as(DHK_STAFF)]);
    const { data } = await admin.from("students").select("id, institute_id").eq("course_id", IDS.coa).eq("institute_id", IDS.dhk).order("roll_no").limit(4);
    students = data!;
  });

  afterAll(async () => {
    const db = service();
    const { data: rs } = await db.from("results").select("id").in("exam_id", examIds);
    const ids = (rs ?? []).map((r) => r.id);
    if (ids.length) {
      await db.from("certificates").update({ supersedes_id: null }).in("result_id", ids);
      await db.from("certificates").delete().in("result_id", ids);
    }
    await db.from("results").delete().in("exam_id", examIds);
    await db.from("exams").delete().in("id", examIds);
    await db.from("grade_scales").delete().eq("code", scaleCode);
  });

  it("includes Viva in totals and full marks and grades on the exam's scale (CGPA 4.00)", async () => {
    const exam = await makeExam({ grade_scale_code: "GPA4" });
    const { data, error } = await insert(exam, 0, 80, 40, 30); // 150 / 200 = 75%
    expect(error).toBeNull();
    expect(data).toMatchObject({ total_marks: 150, full_marks: 200, percentage: 75, grade: "A", grade_point: 3.75, is_pass: true });
    expect((await insert(exam, 1, 80, 40, 51)).error?.message).toMatch(/Viva marks 51(\.00)? exceed full marks 50/);
  });

  it("grades the same percentage differently on the 5.00 scale", async () => {
    const exam = await makeExam({ grade_scale_code: "GPA5" });
    const { data } = await insert(exam, 0, 80, 40, 30); // 75% → A (4.00) on GPA5
    expect(data).toMatchObject({ grade: "A", grade_point: 4, full_marks: 200 });
  });

  it("only publishers can create grading scales; each save is a new version and old results keep theirs", async () => {
    const rules = [{ min_percent: 50, grade: "P", point: 4 }, { min_percent: 0, grade: "F", point: 0 }];
    expect((await staff.rpc("save_grade_scale", { p_code: scaleCode, p_name: "Test", p_max_point: 4, p_rules: rules })).error?.message).toMatch(/Only authorized central roles/);
    expect((await admin.rpc("save_grade_scale", { p_code: scaleCode, p_name: "Test", p_max_point: 4, p_rules: rules })).data).toMatchObject({ version: 1 });
    const exam = await makeExam({ grade_scale_code: scaleCode, viva_full_marks: 0, theory_full_marks: 100, practical_full_marks: 0, pass_marks: 40 });
    const { data: first } = await insert(exam, 0, 60, 0, null);
    expect(first).toMatchObject({ grade: "P", grade_point: 4 });

    const v2 = [{ min_percent: 70, grade: "D", point: 4 }, { min_percent: 50, grade: "M", point: 3 }, { min_percent: 0, grade: "F", point: 0 }];
    expect((await admin.rpc("save_grade_scale", { p_code: scaleCode, p_name: "Test v2", p_max_point: 4, p_rules: v2 })).data).toMatchObject({ version: 2 });
    // New result → version 2
    const { data: second } = await insert(exam, 1, 60, 0, null);
    expect(second).toMatchObject({ grade: "M", grade_point: 3 });
    // Correcting the old draft keeps version 1 rules
    await admin.rpc("correct_result_v2", { p_id: first!.id, p_theory: 65, p_practical: null as never, p_viva: null as never, p_remarks: "", p_display_published_on: null as never, p_grade_override: "", p_grade_point_override: null as never, p_reason: "" });
    const { data: after } = await admin.from("results").select("grade, grade_scale_id").eq("id", first!.id).single();
    expect(after).toMatchObject({ grade: "P", grade_scale_id: first!.grade_scale_id });
    // Invalid rules are refused (no 0% row)
    expect((await admin.rpc("save_grade_scale", { p_code: scaleCode, p_name: "x", p_max_point: 4, p_rules: [{ min_percent: 50, grade: "P", point: 4 }] })).error).not.toBeNull();
  });

  it("prevents duplicate results for the same student and exam", async () => {
    const exam = await makeExam({});
    expect((await insert(exam, 0, 50, 25, 25)).error).toBeNull();
    expect((await insert(exam, 0, 60, 25, 25)).error?.message).toMatch(/duplicate key|results_student_id_exam_id_key/);
  });

  it("keeps the first publication time immutable while the displayed date is editable with a reason", async () => {
    const exam = await makeExam({});
    const { data: r } = await insert(exam, 2, 70, 40, 40);
    await admin.rpc("set_results_publication", { p_ids: [r!.id], p_publish: true });
    const { data: p1 } = await admin.from("results").select("first_published_at, published_at, display_published_on, version").eq("id", r!.id).single();
    expect(p1!.first_published_at).not.toBeNull();
    expect(p1!.display_published_on).not.toBeNull();

    await new Promise((res) => setTimeout(res, 1100));
    await admin.rpc("set_results_publication", { p_ids: [r!.id], p_publish: false });
    await admin.rpc("set_results_publication", { p_ids: [r!.id], p_publish: true });
    const { data: p2 } = await admin.from("results").select("first_published_at, published_at").eq("id", r!.id).single();
    expect(p2!.first_published_at).toBe(p1!.first_published_at); // never rewritten
    expect(p2!.published_at).not.toBe(p1!.published_at); // latest event recorded separately

    // direct attempt to rewrite history is ignored
    await admin.from("results").update({ first_published_at: "2001-01-01T00:00:00Z" }).eq("id", r!.id);
    expect((await admin.from("results").select("first_published_at").eq("id", r!.id).single()).data!.first_published_at).toBe(p1!.first_published_at);

    const args = { p_id: r!.id, p_theory: 70, p_practical: 40, p_viva: 40, p_remarks: "", p_display_published_on: "2026-02-16", p_grade_override: "", p_grade_point_override: null as never };
    expect((await admin.rpc("correct_result_v2", { ...args, p_reason: "" })).error?.message).toMatch(/reason is required/);
    expect((await staff.rpc("correct_result_v2", { ...args, p_reason: "x" })).error?.message).toMatch(/Only authorized central roles/);
    const reason = `Gazette date (${tag})`;
    expect((await admin.rpc("correct_result_v2", { ...args, p_reason: reason })).error).toBeNull();
    const { data: p3 } = await admin.from("results").select("display_published_on, first_published_at, version").eq("id", r!.id).single();
    expect(p3).toMatchObject({ display_published_on: "2026-02-16", first_published_at: p1!.first_published_at, version: p1!.version + 1 });
    const { data: log } = await admin.from("audit_logs").select("old_data, new_data").eq("table_name", "results").eq("record_id", r!.id).eq("reason", reason).single();
    expect((log!.new_data as { display_published_on: string }).display_published_on).toBe("2026-02-16");
  });

  it("grade overrides need a publisher and a reason, and are recorded", async () => {
    const exam = await makeExam({});
    const { data: r } = await insert(exam, 3, 30, 20, 20); // 70/200 → below pass mark 80 → F
    expect(r!.grade).toBe("F");
    const base = { p_id: r!.id, p_theory: 30, p_practical: 20, p_viva: 20, p_remarks: "", p_display_published_on: null as never, p_grade_override: "C", p_grade_point_override: 2 };
    expect((await dhk.rpc("correct_result_v2", { ...base, p_reason: "x" })).error?.message).toMatch(/Only authorized central roles may override/);
    expect((await admin.rpc("correct_result_v2", { ...base, p_reason: "" })).error?.message).toMatch(/reason is required to override/);
    expect((await admin.rpc("correct_result_v2", { ...base, p_reason: "Board decision 12" })).error).toBeNull();
    const { data: o } = await admin.from("results").select("grade, grade_point, grade_override").eq("id", r!.id).single();
    expect(o).toMatchObject({ grade: "C", grade_point: 2, grade_override: "C" });
    const { error } = await dhk.from("results").insert({ exam_id: exam, student_id: students[0].id, institute_id: IDS.dhk, theory_marks: 1, practical_marks: 1, viva_marks: 1, grade_override: "A+" });
    expect(error?.message).toMatch(/Only authorized central roles may override/);
  });

  it("flags a valid certificate for reissue when its result changes, without touching the snapshot", async () => {
    const exam = await makeExam({});
    const { data: r } = await insert(exam, 1, 90, 45, 45);
    await admin.rpc("set_results_publication", { p_ids: [r!.id], p_publish: true });
    await admin.rpc("issue_certificates", { p_result_ids: [r!.id] });
    const { data: c1 } = await admin.from("certificates").select("id, snapshot, needs_reissue").eq("result_id", r!.id).single();
    expect(c1!.needs_reissue).toBe(false);
    await admin.rpc("correct_result_v2", { p_id: r!.id, p_theory: 60, p_practical: 45, p_viva: 45, p_remarks: "", p_display_published_on: null as never, p_grade_override: "", p_grade_point_override: null as never, p_reason: "Recount" });
    const { data: c2 } = await admin.from("certificates").select("snapshot, needs_reissue").eq("id", c1!.id).single();
    expect(c2!.needs_reissue).toBe(true);
    expect(c2!.snapshot).toEqual(c1!.snapshot);
  });

  it("keeps passport numbers private: hidden from anonymous users, other institutes and the audit log", async () => {
    const passport = `P${tag}`.slice(0, 12);
    const target = students[0];
    expect((await admin.from("students").update({ passport_no: passport.toLowerCase() }).eq("id", target.id)).error).toBeNull();
    expect((await admin.from("students").select("passport_no").eq("id", target.id).single()).data!.passport_no).toBe(passport); // normalized
    expect((await anon().from("students").select("passport_no").eq("id", target.id)).data).toHaveLength(0);
    const ctg = await as("ctg.admin@example.org");
    expect((await ctg.from("students").select("passport_no").eq("id", target.id)).data).toHaveLength(0);
    const { data: logs } = await admin.from("audit_logs").select("old_data, new_data").eq("table_name", "students").eq("record_id", target.id).order("id", { ascending: false }).limit(1);
    expect(JSON.stringify(logs)).not.toContain(passport);
    await admin.from("students").update({ passport_no: null }).eq("id", target.id);
  });
});
