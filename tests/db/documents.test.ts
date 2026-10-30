import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, CENTRAL_STAFF, dbAvailable, DHK_ADMIN, IDS, KHL_ADMIN, service, SUPER, type Client } from "./helpers";

type Doc = { id: string; document_no: string; status: string; data: Record<string, string>; layout: unknown; institute_id: string; valid_until: string | null };

describe.skipIf(!dbAvailable)("Document templates and issued documents", () => {
  let admin: Client, centralStaff: Client, dhkAdmin: Client, khlAdmin: Client;
  const db = service();
  const stamp = Date.now().toString(36).toUpperCase();
  let examId = "";
  let students: { id: string; roll_no: string; institute_id: string }[] = [];
  let originalAdmit = "";
  let testAdmit = "";
  let testCert = "";
  let resultId = "";
  const docIds: string[] = [];
  const certIds: string[] = [];

  beforeAll(async () => {
    [admin, centralStaff, dhkAdmin, khlAdmin] = await Promise.all([as(SUPER), as(CENTRAL_STAFF), as(DHK_ADMIN), as(KHL_ADMIN)]);
    const { data: e } = await admin
      .from("exams")
      .insert({ code: `DOC-${stamp}`, name: "Documents test exam", course_id: IDS.coa, session_id: IDS.sessionJul, exam_time: "10:00 AM", venue: "Hall 3" })
      .select("id")
      .single();
    examId = e!.id;
    const { data: dhk } = await admin.from("students").select("id, roll_no, institute_id").eq("course_id", IDS.coa).eq("session_id", IDS.sessionJul).eq("institute_id", IDS.dhk).order("roll_no").limit(2);
    const { data: ctg } = await admin.from("students").select("id, roll_no, institute_id").eq("course_id", IDS.coa).eq("session_id", IDS.sessionJul).eq("institute_id", IDS.ctg).order("roll_no").limit(1);
    students = [...dhk!, ...ctg!];
    const { data: active } = await admin.from("document_templates").select("id").eq("doc_type", "admit_card").eq("status", "active").single();
    originalAdmit = active!.id;
  });

  afterAll(async () => {
    if (originalAdmit) await admin.rpc("activate_document_template", { p_id: originalAdmit });
    if (testCert) await admin.from("document_templates").update({ status: "archived" }).eq("id", testCert);
    await db.from("documents").update({ supersedes_id: null }).in("student_id", students.map((s) => s.id));
    await db.from("documents").delete().in("student_id", students.map((s) => s.id)).in("id", docIds.length ? docIds : ["00000000-0000-0000-0000-000000000000"]);
    await db.from("documents").delete().eq("exam_id", examId);
    await db.from("certificates").delete().in("id", certIds.length ? certIds : ["00000000-0000-0000-0000-000000000000"]);
    await db.from("results").delete().eq("exam_id", examId);
    await db.from("exams").delete().eq("id", examId);
  });

  describe("templates", () => {
    it("only central publishers can create templates or upload designs", async () => {
      const layout = { orientation: "portrait", frame: "classic", fields: [] };
      for (const c of [centralStaff, dhkAdmin]) {
        expect((await c.from("document_templates").insert({ doc_type: "admit_card", name: "Nope", layout }).select("id")).error?.message).toMatch(/row-level security/);
        expect((await c.storage.from("document-templates").upload(`backgrounds/x/${stamp}.png`, new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }))).error).toBeTruthy();
        expect((await c.rpc("activate_document_template", { p_id: originalAdmit })).error?.message).toMatch(/Only authorized central roles/);
      }
      // Staff can read templates (needed to render documents); anonymous users cannot.
      expect((await dhkAdmin.from("document_templates").select("id").eq("id", originalAdmit)).data).toHaveLength(1);
      expect((await anon().from("document_templates").select("id")).data ?? []).toHaveLength(0);
    });

    it("active templates are immutable; drafts are editable and deletable", async () => {
      const { data: orig } = await admin.from("document_templates").select("layout, family_id").eq("id", originalAdmit).single();
      expect((await admin.from("document_templates").update({ layout: { ...(orig!.layout as object), fields: [] } }).eq("id", originalAdmit)).error?.message).toMatch(/Only draft templates can be edited/);
      expect((await admin.from("document_templates").delete().eq("id", originalAdmit)).error?.message).toMatch(/Only draft templates can be deleted/);
      const { data: draft, error } = await admin
        .from("document_templates")
        .insert({ doc_type: "admit_card", name: `DB test admit ${stamp}`, family_id: orig!.family_id, version: 99, layout: orig!.layout })
        .select("id, status")
        .single();
      expect(error).toBeNull();
      expect(draft!.status).toBe("draft");
      testAdmit = draft!.id;
      const layout = orig!.layout as { fields: { id: string; text?: string }[] };
      const edited = { ...layout, fields: layout.fields.map((f) => (f.text === "Directions" ? { ...f, text: "Instructions" } : f)) };
      expect((await admin.from("document_templates").update({ layout: edited }).eq("id", testAdmit)).error).toBeNull();
    });

    it("activating a draft archives the previously active version", async () => {
      expect((await admin.rpc("activate_document_template", { p_id: testAdmit })).error).toBeNull();
      const { data } = await admin.from("document_templates").select("id, status").in("id", [originalAdmit, testAdmit]);
      expect(Object.fromEntries(data!.map((t) => [t.id, t.status]))).toEqual({ [originalAdmit]: "archived", [testAdmit]: "active" });
      // Re-activating an archived version is a rollback.
      expect((await admin.rpc("activate_document_template", { p_id: originalAdmit })).error).toBeNull();
      expect((await admin.from("document_templates").select("status").eq("id", originalAdmit).single()).data!.status).toBe("active");
    });
  });

  describe("admit and registration cards", () => {
    it("only central publishers can issue; issuing snapshots data and is idempotent", async () => {
      const ids = students.map((s) => s.id);
      expect((await dhkAdmin.rpc("issue_documents", { p_type: "admit_card", p_students: ids, p_exam: examId, p_extra: {} })).error?.message).toMatch(/Only authorized central roles/);
      const first = await admin.rpc("issue_documents", { p_type: "admit_card", p_students: ids, p_exam: examId, p_extra: { seat_no: "{roll_no}", examinee_type: "Regular" } });
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ issued: 3, skipped: 0 });
      expect((await admin.rpc("issue_documents", { p_type: "admit_card", p_students: ids, p_exam: examId, p_extra: {} })).data).toMatchObject({ issued: 0, skipped: 3 });
      const { data } = await admin.from("documents").select("id, document_no, status, data, layout, institute_id, valid_until").eq("exam_id", examId);
      const docs = data as Doc[];
      docIds.push(...docs.map((d) => d.id));
      const d = docs.find((x) => x.data.roll_no === students[0].roll_no)!;
      expect(d.data).toMatchObject({ exam_time: "10:00 AM", venue: "Hall 3", seat_no: students[0].roll_no, examinee_type: "Regular", document_no: d.document_no });
      expect(d.document_no).toMatch(/^[A-Z0-9]+-A\d{2}-[0-9A-Z]{8}$/);
      expect(Object.keys(d.data)).not.toContain("passport_no");
      expect(Object.keys(d.data)).not.toContain("national_id");
      expect((d.layout as { fields: unknown[] }).fields.length).toBeGreaterThan(10);
    });

    it("rejects students outside the exam's course", async () => {
      const { data: other } = await admin.from("students").select("id").neq("course_id", IDS.coa).limit(1).single();
      expect((await admin.rpc("issue_documents", { p_type: "admit_card", p_students: [other!.id], p_exam: examId, p_extra: {} })).error?.message).toMatch(/not enrolled in the course/);
    });

    it("institutes only see their own documents and cannot change them", async () => {
      const dhkSees = (await dhkAdmin.from("documents").select("institute_id").eq("exam_id", examId)).data!;
      expect(dhkSees.length).toBe(2);
      expect(dhkSees.every((d) => d.institute_id === IDS.dhk)).toBe(true);
      expect((await khlAdmin.from("documents").select("id").eq("exam_id", examId)).data).toHaveLength(0);
      const { data: anyDoc } = await admin.from("documents").select("id").eq("exam_id", examId).eq("institute_id", IDS.dhk).limit(1).single();
      await dhkAdmin.from("documents").update({ status: "revoked" }).eq("id", anyDoc!.id);
      expect((await admin.from("documents").select("status").eq("id", anyDoc!.id).single()).data!.status).toBe("valid");
      expect((await dhkAdmin.rpc("revoke_document", { p_id: anyDoc!.id, p_reason: "x" })).error?.message).toMatch(/Only authorized central roles/);
    });

    it("issued documents keep their template snapshot when the template changes", async () => {
      const { data: before } = await admin.from("documents").select("id, layout").eq("exam_id", examId).limit(1).single();
      await admin.rpc("activate_document_template", { p_id: testAdmit });
      const { data: after } = await admin.from("documents").select("layout").eq("id", before!.id).single();
      expect(after!.layout).toEqual(before!.layout);
      expect(JSON.stringify(after!.layout)).toContain("Directions");
      await admin.rpc("activate_document_template", { p_id: originalAdmit });
    });

    it("verifies: valid → revoked; reissue makes the old one superseded and the new one valid", async () => {
      const verify = async (no: string) => (await db.rpc("public_verify_document", { p_no: no.toLowerCase() })).data![0];
      const { data } = await admin.from("documents").select("id, document_no, data").eq("exam_id", examId).order("document_no");
      const [a, b] = data as Doc[];
      expect(await verify(a.document_no)).toMatchObject({ doc_type: "admit_card", status: "valid", student_name: a.data.student_name, exam_name: "Documents test exam" });
      expect((await anon().rpc("public_verify_document", { p_no: a.document_no })).error?.message).toMatch(/permission denied/);

      expect((await admin.rpc("revoke_document", { p_id: a.id, p_reason: " " })).error?.message).toMatch(/reason is required/);
      expect((await admin.rpc("revoke_document", { p_id: a.id, p_reason: "Issued in error" })).error).toBeNull();
      expect(await verify(a.document_no)).toMatchObject({ status: "revoked", superseded_by: null });

      const student = students.find((s) => s.roll_no === b.data.roll_no)!;
      const { data: prior } = await admin.from("students").select("father_name").eq("id", student.id).single();
      await admin.from("students").update({ father_name: "Corrected Father" }).eq("id", student.id);
      const re = await admin.rpc("reissue_document", { p_id: b.id, p_reason: "Father's name corrected", p_extra: { seat_no: "B-12" } });
      await admin.from("students").update({ father_name: prior!.father_name }).eq("id", student.id);
      expect(re.error).toBeNull();
      const fresh = re.data as { id: string; document_no: string };
      docIds.push(fresh.id);
      expect(await verify(b.document_no)).toMatchObject({ status: "superseded", superseded_by: fresh.document_no });
      expect(await verify(fresh.document_no)).toMatchObject({ status: "valid" });
      const { data: n } = await admin.from("documents").select("data, supersedes_id").eq("id", fresh.id).single();
      expect(n!.supersedes_id).toBe(b.id);
      expect(n!.data).toMatchObject({ father_name: "Corrected Father", seat_no: "B-12", examinee_type: b.data.examinee_type });
      expect((await admin.rpc("reissue_document", { p_id: b.id, p_reason: "again", p_extra: {} })).error?.message).toMatch(/Only valid documents/);
      const { data: logs } = await admin.from("audit_logs").select("reason").eq("table_name", "documents").eq("record_id", b.id);
      expect(logs!.map((l) => l.reason)).toContain("Reissued: Father's name corrected");
    });

    it("registration cards: one valid per student, configurable validity, expiry", async () => {
      const s = students[0];
      await db.from("documents").update({ status: "revoked", revoke_reason: "test reset" }).eq("doc_type", "registration_card").eq("student_id", s.id).eq("status", "valid");
      const r = await admin.rpc("issue_documents", { p_type: "registration_card", p_students: [s.id], p_exam: null as never, p_extra: { valid_until: "2030-12-31" } });
      expect(r.data).toMatchObject({ issued: 1 });
      const { data: card } = await admin.from("documents").select("id, document_no, valid_until, data").eq("doc_type", "registration_card").eq("student_id", s.id).eq("status", "valid").single();
      docIds.push(card!.id);
      expect(card!.valid_until).toBe("2030-12-31");
      expect((card!.data as Record<string, string>).valid_until).toBe("31 December 2030");
      expect((await admin.rpc("issue_documents", { p_type: "registration_card", p_students: [s.id], p_exam: null as never, p_extra: {} })).data).toMatchObject({ issued: 0, skipped: 1 });
      // Past validity → expired (set directly; the UI only allows reissuing with a new date).
      await db.from("documents").update({ valid_until: "2020-01-01" }).eq("id", card!.id);
      expect((await db.rpc("public_verify_document", { p_no: card!.document_no })).data![0]).toMatchObject({ doc_type: "registration_card", status: "expired" });
    });
  });

  describe("certificates with templates", () => {
    let legacyNo = "";

    beforeAll(async () => {
      const { data: r } = await admin.from("results").insert({ exam_id: examId, student_id: students[0].id, institute_id: IDS.dhk, theory_marks: 60, practical_marks: 25 }).select("id").single();
      resultId = r!.id;
      await admin.rpc("set_results_publication", { p_ids: [resultId], p_publish: true });
    });

    it("without an active certificate template, certificates keep the built-in design", async () => {
      expect((await admin.from("document_templates").select("id").eq("doc_type", "certificate").eq("status", "active")).data).toHaveLength(0);
      expect((await admin.rpc("issue_certificates", { p_result_ids: [resultId] })).error).toBeNull();
      const { data: c } = await admin.from("certificates").select("id, certificate_no, layout, template_id, snapshot").eq("result_id", resultId).eq("status", "valid").single();
      certIds.push(c!.id);
      legacyNo = c!.certificate_no;
      expect(c!.layout).toBeNull();
      expect(c!.template_id).toBeNull();
      expect(c!.snapshot).toMatchObject({ document_no: c!.certificate_no, course_title: expect.any(String), gpa_text: expect.stringMatching(/^GPA \d\.\d{2} on a scale of 5\.00$/) });
    });

    it("an activated certificate template is snapshotted; earlier certificates still verify", async () => {
      const { data: seeded } = await admin.from("document_templates").select("layout").eq("doc_type", "certificate").eq("status", "draft").limit(1).single();
      const { data: t } = await admin.from("document_templates").insert({ doc_type: "certificate", name: `DB test certificate ${stamp}`, layout: seeded!.layout }).select("id").single();
      testCert = t!.id;
      await admin.rpc("activate_document_template", { p_id: testCert });
      const re = await admin.rpc("reissue_certificate", { p_id: certIds[0], p_reason: "Template rollout" });
      expect(re.error).toBeNull();
      const { data: c } = await admin.from("certificates").select("id, certificate_no, layout, template_id, supersedes_id").eq("result_id", resultId).eq("status", "valid").single();
      certIds.push(c!.id);
      expect(c!.template_id).toBe(testCert);
      expect(c!.layout).toEqual(seeded!.layout);
      const verify = async (no: string) => (await db.rpc("public_verify_certificate", { p_certificate_no: no })).data![0];
      expect(await verify(c!.certificate_no)).toMatchObject({ status: "valid" });
      expect(await verify(legacyNo)).toMatchObject({ status: "revoked", superseded_by: c!.certificate_no });
      await db.from("certificates").update({ supersedes_id: null }).eq("id", c!.id);
    });
  });
});
