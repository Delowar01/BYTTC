import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, CENTRAL_STAFF, dbAvailable, DHK_ADMIN, IDS, service, SUPER, type Client } from "./helpers";

describe.skipIf(!dbAvailable)("Certificates: issue, verify, revoke, reissue", () => {
  let admin: Client, centralStaff: Client, dhkAdmin: Client;
  let examId = "";
  let passId = "";
  let failId = "";
  let draftId = "";
  const code = `C-${Date.now().toString(36).toUpperCase()}`;

  beforeAll(async () => {
    [admin, centralStaff, dhkAdmin] = await Promise.all([as(SUPER), as(CENTRAL_STAFF), as(DHK_ADMIN)]);
    const { data: exam } = await admin.from("exams").insert({ code, name: "Certificate test exam", course_id: IDS.coa, session_id: IDS.sessionJul }).select("id").single();
    examId = exam!.id;
    const { data: students } = await admin.from("students").select("id").eq("course_id", IDS.coa).eq("institute_id", IDS.dhk).order("roll_no").limit(3);
    const { data: rows } = await admin
      .from("results")
      .insert([
        { exam_id: examId, student_id: students![0].id, theory_marks: 60, practical_marks: 25, institute_id: IDS.dhk },
        { exam_id: examId, student_id: students![1].id, theory_marks: 10, practical_marks: 5, institute_id: IDS.dhk },
        { exam_id: examId, student_id: students![2].id, theory_marks: 50, practical_marks: 30, institute_id: IDS.dhk },
      ])
      .select("id, student_id");
    [passId, failId, draftId] = rows!.map((r) => r.id);
    await admin.rpc("set_results_publication", { p_ids: [passId, failId], p_publish: true });
  });

  afterAll(async () => {
    const db = service();
    await db.from("certificates").update({ supersedes_id: null }).in("result_id", [passId, failId, draftId]);
    await db.from("certificates").delete().in("result_id", [passId, failId, draftId]);
    await db.from("results").delete().eq("exam_id", examId);
    await db.from("exams").delete().eq("id", examId);
  });

  it("only central publishers can issue", async () => {
    expect((await centralStaff.rpc("issue_exam_certificates", { p_exam_id: examId })).error?.message).toMatch(/Only authorized central roles/);
    expect((await dhkAdmin.rpc("issue_certificates", { p_result_ids: [passId] })).error?.message).toMatch(/Only authorized central roles/);
  });

  it("issues only for published, passing results — once", async () => {
    const { data } = await admin.rpc("issue_exam_certificates", { p_exam_id: examId });
    expect(data).toMatchObject({ issued: 1, skipped: 0 }); // draft and failed results are not eligible
    const { data: again } = await admin.rpc("issue_certificates", { p_result_ids: [passId, failId, draftId] });
    expect(again).toMatchObject({ issued: 0, skipped: 3 });
    const { data: cert } = await admin.from("certificates").select("certificate_no, status, snapshot").eq("result_id", passId).single();
    expect(cert!.certificate_no).toMatch(/^STTN-\d{2}-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(cert!.snapshot).toMatchObject({ grade: "A+", course_code: "COA", exam_code: code });
  });

  it("verification is public through the server only and shows the issued data", async () => {
    const { data: cert } = await admin.from("certificates").select("certificate_no").eq("result_id", passId).single();
    expect((await anon().rpc("public_verify_certificate", { p_certificate_no: cert!.certificate_no })).error?.message).toMatch(/permission denied/);
    const { data } = await service().rpc("public_verify_certificate", { p_certificate_no: cert!.certificate_no.toLowerCase() });
    expect(data![0]).toMatchObject({ status: "valid", grade: "A+", superseded_by: null });
    expect(Object.keys(data![0])).not.toContain("father_name");
  });

  it("blocks unpublishing a result that has a valid certificate", async () => {
    const { error } = await admin.rpc("set_results_publication", { p_ids: [passId], p_publish: false });
    expect(error?.message).toMatch(/revoke the certificate before unpublishing/);
  });

  it("reissue revokes the old certificate and links the new one", async () => {
    await admin.rpc("correct_result", { p_id: passId, p_theory: 50, p_practical: 25, p_remarks: "", p_reason: "Re-check" });
    const { data: old } = await admin.from("certificates").select("id, certificate_no").eq("result_id", passId).eq("status", "valid").single();
    expect((await admin.rpc("reissue_certificate", { p_id: old!.id, p_reason: "" })).error?.message).toMatch(/reason is required/);
    const { data: res } = await admin.rpc("reissue_certificate", { p_id: old!.id, p_reason: "Marks corrected" });
    const fresh = (res as { certificate_no: string }).certificate_no;
    expect(fresh).not.toBe(old!.certificate_no);

    const { data: oldView } = await service().rpc("public_verify_certificate", { p_certificate_no: old!.certificate_no });
    expect(oldView![0]).toMatchObject({ status: "revoked", superseded_by: fresh });
    const { data: newView } = await service().rpc("public_verify_certificate", { p_certificate_no: fresh });
    expect(newView![0]).toMatchObject({ status: "valid", grade: "A" }); // 75% after correction (was 85%, A+)
  });

  it("revocation requires a reason, is audited, and then allows unpublishing", async () => {
    const { data: cert } = await admin.from("certificates").select("id, certificate_no").eq("result_id", passId).eq("status", "valid").single();
    expect((await dhkAdmin.rpc("revoke_certificate", { p_id: cert!.id, p_reason: "x" })).error?.message).toMatch(/Only authorized central roles/);
    expect((await admin.rpc("revoke_certificate", { p_id: cert!.id, p_reason: " " })).error?.message).toMatch(/reason is required/);
    expect((await admin.rpc("revoke_certificate", { p_id: cert!.id, p_reason: "Issued in error" })).error).toBeNull();
    const { data: view } = await service().rpc("public_verify_certificate", { p_certificate_no: cert!.certificate_no });
    expect(view![0].status).toBe("revoked");
    const { data: log } = await admin.from("audit_logs").select("reason").eq("table_name", "certificates").eq("record_id", cert!.id).eq("action", "UPDATE").single();
    expect(log!.reason).toBe("Issued in error");
    expect((await admin.rpc("set_results_publication", { p_ids: [passId], p_publish: false })).error).toBeNull();
  });
});
