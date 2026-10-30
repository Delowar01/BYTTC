import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { as, CENTRAL_ADMIN, dbAvailable, IDS, service, SUPER, type Client } from "./helpers";

describe.skipIf(!dbAvailable)("Result publication workflow (database-enforced)", () => {
  let admin: Client, centralAdmin: Client;
  let examId = "";
  let studentIds: string[] = [];
  const code = `T-${Date.now().toString(36).toUpperCase()}`;

  beforeAll(async () => {
    [admin, centralAdmin] = await Promise.all([as(SUPER), as(CENTRAL_ADMIN)]);
    const { data: exam, error } = await admin
      .from("exams")
      .insert({ code, name: "Test exam", course_id: IDS.coa, session_id: IDS.sessionJul, theory_full_marks: 60, practical_full_marks: 40, pass_marks: 40 })
      .select("id")
      .single();
    if (error) throw error;
    examId = exam.id;
    const { data: students } = await admin.from("students").select("id").eq("course_id", IDS.coa).order("roll_no").limit(3);
    studentIds = students!.map((s) => s.id);
  });

  afterAll(async () => {
    const db = service();
    const { data: batches } = await db.from("results").select("batch_id").eq("exam_id", examId);
    await db.from("results").delete().eq("exam_id", examId);
    await db.from("import_batches").delete().in("id", (batches ?? []).map((b) => b.batch_id).filter((v): v is string => !!v));
    await db.from("exams").delete().eq("id", examId);
  });

  it("refuses to create results in a published state (no auto-publish), even for super admin", async () => {
    const { error } = await admin.from("results").insert({ exam_id: examId, student_id: studentIds[0], theory_marks: 50, practical_marks: 30, status: "published", institute_id: IDS.dhk });
    expect(error?.message).toMatch(/must be created as draft or submitted/);
  });

  it("computes total, percentage, grade and pass/fail in the database", async () => {
    const { data, error } = await admin
      .from("results")
      .insert([
        { exam_id: examId, student_id: studentIds[0], theory_marks: 50, practical_marks: 32, institute_id: IDS.dhk },
        { exam_id: examId, student_id: studentIds[1], theory_marks: 20, practical_marks: 15, institute_id: IDS.dhk },
      ])
      .select("total_marks, percentage, grade, grade_point, is_pass, status, institute_id, student_id");
    expect(error).toBeNull();
    const [a, b] = data!;
    expect(a).toMatchObject({ total_marks: 82, percentage: 82, grade: "A+", grade_point: 5, is_pass: true, status: "draft" });
    expect(b).toMatchObject({ total_marks: 35, grade: "F", grade_point: 0, is_pass: false });
    // tenant column is derived from the student, never trusted from the client
    const { data: s } = await admin.from("students").select("institute_id").eq("id", studentIds[0]).single();
    expect(a.institute_id).toBe(s!.institute_id);
  });

  it("rejects marks above the exam's full marks", async () => {
    const { error } = await admin.from("results").insert({ exam_id: examId, student_id: studentIds[2], theory_marks: 61, practical_marks: 0, institute_id: IDS.dhk });
    expect(error?.message).toMatch(/exceed full marks/);
  });

  it("requires an authorized role and a reason to correct a published result, and audits it", async () => {
    const { data: r } = await admin.from("results").select("id, version").eq("exam_id", examId).eq("student_id", studentIds[0]).single();
    expect((await centralAdmin.rpc("set_results_publication", { p_ids: [r!.id], p_publish: true })).error).toBeNull();

    const noReason = await admin.rpc("correct_result", { p_id: r!.id, p_theory: 55, p_practical: 32, p_remarks: "", p_reason: "" });
    expect(noReason.error?.message).toMatch(/reason is required/);

    const withReason = await admin.rpc("correct_result", { p_id: r!.id, p_theory: 55, p_practical: 32, p_remarks: "", p_reason: "Re-evaluation request #42" });
    expect(withReason.error).toBeNull();
    const { data: after } = await admin.from("results").select("total_marks, version, status").eq("id", r!.id).single();
    expect(after).toEqual({ total_marks: 87, version: r!.version + 1, status: "published" });

    const { data: log } = await admin.from("audit_logs").select("reason, old_data, new_data").eq("table_name", "results").eq("record_id", r!.id).eq("action", "UPDATE").order("id", { ascending: false }).limit(1).single();
    expect(log!.reason).toBe("Re-evaluation request #42");
    expect((log!.old_data as { theory_marks: number }).theory_marks).toBe(50);
    expect((log!.new_data as { theory_marks: number }).theory_marks).toBe(55);
  });

  it("commits a batch atomically: one bad row means nothing is inserted", async () => {
    const payload = [
      { student_id: studentIds[2], exam_id: examId, theory_marks: 40, practical_marks: 20, remarks: null },
      // duplicate of an existing result -> unique violation inside the transaction
      { student_id: studentIds[0], exam_id: examId, theory_marks: 40, practical_marks: 20, remarks: null },
    ];
    const { data: batch } = await admin.from("import_batches").insert({ kind: "results", file_name: "atomic.csv", total_rows: 2, valid_rows: 2, payload }).select("id").single();
    const { data, error } = await admin.rpc("commit_result_batch", { p_batch_id: batch!.id });
    expect(error).toBeNull();
    expect(data).toMatchObject({ ok: false });
    const { data: b } = await admin.from("import_batches").select("status, failure_reason").eq("id", batch!.id).single();
    expect(b!.status).toBe("failed");
    expect(b!.failure_reason).toMatch(/duplicate key/);
    const { count } = await admin.from("results").select("*", { count: "exact", head: true }).eq("batch_id", batch!.id);
    expect(count).toBe(0);
  });

  it("runs the full batch lifecycle: commit as draft → publish → unpublish → rollback", async () => {
    const payload = [{ student_id: studentIds[2], exam_id: examId, theory_marks: 45, practical_marks: 25, remarks: "ok" }];
    const { data: batch } = await admin.from("import_batches").insert({ kind: "results", file_name: "life.csv", total_rows: 1, valid_rows: 1, payload }).select("id").single();
    const id = batch!.id;
    const status = async () => (await admin.from("import_batches").select("status").eq("id", id).single()).data!.status;

    expect((await admin.rpc("commit_result_batch", { p_batch_id: id })).data).toMatchObject({ ok: true, inserted: 1 });
    expect(await status()).toBe("committed");
    const { data: drafts } = await admin.from("results").select("status").eq("batch_id", id);
    expect(drafts!.map((d) => d.status)).toEqual(["draft"]);

    expect((await admin.rpc("commit_result_batch", { p_batch_id: id })).error?.message).toMatch(/cannot be committed from status committed/);

    expect((await admin.rpc("set_batch_publication", { p_batch_id: id, p_publish: true })).data).toMatchObject({ affected: 1 });
    expect(await status()).toBe("published");
    expect((await admin.rpc("rollback_result_batch", { p_batch_id: id, p_reason: "x" })).error?.message).toMatch(/cannot be rolled back from status published/);

    // the public lookup now returns the result
    const { data: stu } = await admin.from("students").select("roll_no, registration_no").eq("id", studentIds[2]).single();
    const { data: pub } = await service().rpc("public_result_lookup", { p_roll: stu!.roll_no, p_registration: stu!.registration_no });
    expect(pub!.map((p) => p.exam_code)).toContain(code);
    expect(Object.keys(pub![0])).not.toEqual(expect.arrayContaining(["father_name", "phone", "national_id", "date_of_birth"]));

    expect((await admin.rpc("set_batch_publication", { p_batch_id: id, p_publish: false })).data).toMatchObject({ affected: 1 });
    const { data: hidden } = await service().rpc("public_result_lookup", { p_roll: stu!.roll_no, p_registration: stu!.registration_no });
    expect(hidden!.map((p) => p.exam_code)).not.toContain(code);

    expect((await admin.rpc("rollback_result_batch", { p_batch_id: id, p_reason: "" })).error?.message).toMatch(/reason is required/);
    const reason = `Wrong file (${code})`; // audit log is append-only: keep the reason unique per run
    expect((await admin.rpc("rollback_result_batch", { p_batch_id: id, p_reason: reason })).data).toMatchObject({ ok: true, deleted: 1 });
    expect(await status()).toBe("rolled_back");
    const { data: audit } = await admin.from("audit_logs").select("reason").eq("table_name", "results").eq("action", "DELETE").eq("reason", reason);
    expect(audit!.length).toBe(1);
  });
});
