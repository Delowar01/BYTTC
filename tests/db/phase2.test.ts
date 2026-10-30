import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, CENTRAL_STAFF, dbAvailable, DHK_ADMIN, DHK_STAFF, IDS, service, SUPER, type Client } from "./helpers";

const GD = "22222222-0000-4000-8000-000000000002";
const RAC = "22222222-0000-4000-8000-000000000005";

describe.skipIf(!dbAvailable)("Phase 2: course assignments and result submission", () => {
  let superAdmin: Client, dhkAdmin: Client, dhkStaff: Client, centralStaff: Client;
  let examId = "";
  const created: string[] = [];
  const code = `P2-${Date.now().toString(36).toUpperCase()}`;

  beforeAll(async () => {
    [superAdmin, dhkAdmin, dhkStaff, centralStaff] = await Promise.all([as(SUPER), as(DHK_ADMIN), as(DHK_STAFF), as(CENTRAL_STAFF)]);
    const { data } = await superAdmin.from("exams").insert({ code, name: "Phase 2 test exam", course_id: IDS.coa, session_id: IDS.sessionJul }).select("id").single();
    examId = data!.id;
  });
  afterAll(async () => {
    const db = service();
    await db.from("results").delete().eq("exam_id", examId);
    await db.from("exams").delete().eq("id", examId);
    if (created.length) await db.from("students").delete().in("id", created);
  });

  it("refuses to enrol a student in a course not assigned to the institute (any role)", async () => {
    // RAC is not assigned to DHK-001 in the seed
    for (const client of [superAdmin, dhkAdmin]) {
      const { error } = await client.from("students").insert({ institute_id: IDS.dhk, course_id: RAC, session_id: IDS.sessionJul, name_en: "Wrong Course", registration_no: "" });
      expect(error?.message).toMatch(/Course is not assigned to this institute/);
    }
    const { data, error } = await dhkAdmin.from("students").insert({ institute_id: IDS.dhk, course_id: GD, session_id: IDS.sessionJul, name_en: "Right Course", registration_no: "" }).select("id").single();
    expect(error).toBeNull();
    created.push(data!.id);
  });

  it("lets institutes read but not change their course assignments", async () => {
    const { data } = await dhkAdmin.from("institute_courses").select("institute_id");
    expect(data!.length).toBeGreaterThan(0);
    expect(new Set(data!.map((d) => d.institute_id))).toEqual(new Set([IDS.dhk]));
    const { error } = await dhkAdmin.from("institute_courses").insert({ institute_id: IDS.dhk, course_id: RAC });
    expect(error?.message).toMatch(/row-level security/);
    const del = await centralStaff.from("institute_courses").delete().eq("institute_id", IDS.dhk).select("course_id");
    expect(del.data).toHaveLength(0); // central staff cannot change assignments either
  });

  it("institute staff enter drafts and submit them; other institutes are unaffected", async () => {
    const { data: own } = await dhkStaff.from("students").select("id").eq("course_id", IDS.coa).limit(2);
    const { data: other } = await superAdmin.from("students").select("id").eq("course_id", IDS.coa).eq("institute_id", IDS.ctg).limit(1).single();

    const ins = await dhkStaff.from("results").insert(own!.map((s) => ({ exam_id: examId, student_id: s.id, theory_marks: 40, practical_marks: 20, institute_id: IDS.dhk }))).select("status");
    expect(ins.error).toBeNull();
    expect(ins.data!.every((r) => r.status === "draft")).toBe(true);
    // central draft for another institute
    await superAdmin.from("results").insert({ exam_id: examId, student_id: other!.id, theory_marks: 30, practical_marks: 20, institute_id: IDS.ctg });

    // tenants cannot create results for other institutes' students
    const cross = await dhkStaff.from("results").insert({ exam_id: examId, student_id: other!.id, theory_marks: 1, practical_marks: 1, institute_id: IDS.dhk });
    expect(cross.error).not.toBeNull();

    const { data: res, error } = await dhkStaff.rpc("submit_results", { p_exam_id: examId });
    expect(error).toBeNull();
    expect(res).toMatchObject({ submitted: 2 });
    const { data: statuses } = await superAdmin.from("results").select("status, institute_id").eq("exam_id", examId);
    expect(statuses!.filter((s) => s.institute_id === IDS.dhk).every((s) => s.status === "submitted")).toBe(true);
    expect(statuses!.find((s) => s.institute_id === IDS.ctg)!.status).toBe("draft");
  });

  it("only central publishers can publish submitted results", async () => {
    const { data: submitted } = await superAdmin.from("results").select("id").eq("exam_id", examId).eq("status", "submitted");
    const ids = submitted!.map((r) => r.id);
    expect((await dhkAdmin.rpc("set_results_publication", { p_ids: ids, p_publish: true })).error?.message).toMatch(/Only authorized central roles/);
    const direct = await dhkAdmin.from("results").update({ status: "published" }).in("id", ids).select("id");
    expect(direct.error?.message ?? "").toMatch(/Only authorized central roles|Institute users can only/);
    const ok = await superAdmin.rpc("set_results_publication", { p_ids: ids, p_publish: true });
    expect(ok.data).toMatchObject({ affected: ids.length });
    // published rows are now read-only for the institute
    const edit = await dhkStaff.from("results").update({ theory_marks: 1 }).in("id", ids).select("id");
    expect(edit.data).toHaveLength(0);
  });
});
