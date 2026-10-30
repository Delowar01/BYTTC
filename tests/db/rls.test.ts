import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, as, CENTRAL_STAFF, dbAvailable, DHK_ADMIN, DHK_STAFF, IDS, KHL_ADMIN, service, SUPER, type Client } from "./helpers";

describe.skipIf(!dbAvailable)("Row Level Security and tenant isolation", () => {
  let dhkAdmin: Client, dhkStaff: Client, khlAdmin: Client, centralStaff: Client, superAdmin: Client;
  const cleanupStudents: string[] = [];

  beforeAll(async () => {
    [dhkAdmin, dhkStaff, khlAdmin, centralStaff, superAdmin] = await Promise.all([as(DHK_ADMIN), as(DHK_STAFF), as(KHL_ADMIN), as(CENTRAL_STAFF), as(SUPER)]);
  });
  afterAll(async () => {
    if (cleanupStudents.length) await service().from("students").delete().in("id", cleanupStudents);
  });

  describe("anonymous visitors", () => {
    it("cannot read students, results, institutes, batches or audit logs", async () => {
      const db = anon();
      for (const table of ["students", "results", "institutes", "import_batches", "audit_logs", "profiles", "contact_messages"] as const) {
        const { data } = await db.from(table).select("*").limit(5);
        expect(data ?? [], table).toHaveLength(0);
      }
    });

    it("cannot write students", async () => {
      const { error } = await anon().from("students").insert({ institute_id: IDS.dhk, course_id: IDS.coa, session_id: IDS.sessionJul, name_en: "Hacker", registration_no: "" });
      expect(error).not.toBeNull();
    });

    it("cannot call the result lookup directly (server-only, rate limited)", async () => {
      const { error } = await anon().rpc("public_result_lookup", { p_roll: "200001", p_registration: "2600000001" });
      expect(error?.message).toMatch(/permission denied/);
    });

    it("sees only approved institutes in the public directory, without private fields", async () => {
      const { data, error } = await anon().rpc("public_institutes", { p_search: "" });
      expect(error).toBeNull();
      expect(data!.map((i) => i.code).sort()).toEqual(expect.arrayContaining(["CTG-001", "DHK-001", "RAJ-001"]));
      expect(data!.map((i) => i.code)).not.toContain("SYL-001"); // pending
      expect(data!.map((i) => i.code)).not.toContain("KHL-001"); // suspended
      expect(Object.keys(data![0])).not.toContain("email");
      expect(Object.keys(data![0])).not.toContain("remarks");
    });

    it("can read published CMS content only", async () => {
      const { data } = await anon().from("pages").select("slug, is_published");
      expect(data!.length).toBeGreaterThan(5);
      expect(data!.every((p) => p.is_published)).toBe(true);
    });

    it("cannot read private documents", async () => {
      const { data } = await anon().storage.from("private-documents").list("imports");
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe("institute users", () => {
    it("see only their own institute's students and results", async () => {
      const { data: students } = await dhkAdmin.from("students").select("institute_id");
      expect(students!.length).toBeGreaterThan(0);
      expect(new Set(students!.map((s) => s.institute_id))).toEqual(new Set([IDS.dhk]));
      const { data: results } = await dhkAdmin.from("results").select("institute_id");
      expect(new Set(results!.map((r) => r.institute_id))).toEqual(new Set([IDS.dhk]));
      const { data: other } = await dhkAdmin.from("students").select("id").eq("institute_id", IDS.ctg);
      expect(other).toHaveLength(0);
    });

    it("cannot create students in another institute", async () => {
      const { error } = await dhkAdmin.from("students").insert({ institute_id: IDS.ctg, course_id: IDS.coa, session_id: IDS.sessionJul, name_en: "Cross Tenant", registration_no: "" });
      expect(error?.message).toMatch(/row-level security/);
    });

    it("can create a student in their own institute (identifiers generated)", async () => {
      const { data, error } = await dhkStaff
        .from("students")
        .insert({ institute_id: IDS.dhk, course_id: IDS.coa, session_id: IDS.sessionJul, name_en: "Tenant Created", registration_no: "" })
        .select("id, roll_no, registration_no")
        .single();
      expect(error).toBeNull();
      cleanupStudents.push(data!.id);
      expect(data!.roll_no).toMatch(/^\d{6,}$/);
      expect(data!.registration_no).toMatch(/^\d{10}$/);
      // institute staff may not delete students (institute admin may)
      const { data: deleted } = await dhkStaff.from("students").delete().eq("id", data!.id).select("id");
      expect(deleted).toHaveLength(0);
    });

    it("cannot publish results or change published results", async () => {
      const { data: published } = await dhkAdmin.from("results").select("id, theory_marks").eq("status", "published").limit(1).single();
      const { error } = await dhkAdmin.rpc("set_results_publication", { p_ids: [published!.id], p_publish: false });
      expect(error?.message).toMatch(/Only authorized central roles/);
      const { data: updated } = await dhkAdmin.from("results").update({ theory_marks: 1 }).eq("id", published!.id).select("id");
      expect(updated).toHaveLength(0);
      const { data: after } = await service().from("results").select("theory_marks, status").eq("id", published!.id).single();
      expect(after).toEqual({ theory_marks: published!.theory_marks, status: "published" });
    });

    it("cannot read the audit log", async () => {
      const { data } = await dhkAdmin.from("audit_logs").select("id").limit(1);
      expect(data).toHaveLength(0);
    });

    it("lose all access while their institute is suspended", async () => {
      const { data } = await khlAdmin.from("students").select("id");
      expect(data).toHaveLength(0);
      const { error } = await khlAdmin.from("students").insert({ institute_id: IDS.khl, course_id: IDS.coa, session_id: IDS.sessionJul, name_en: "Suspended", registration_no: "" });
      expect(error).not.toBeNull();
    });
  });

  describe("central roles", () => {
    it("central staff can read every institute's students", async () => {
      const { data } = await centralStaff.from("students").select("institute_id");
      expect(new Set(data!.map((s) => s.institute_id)).size).toBeGreaterThanOrEqual(3);
    });

    it("central staff cannot publish (RPC and direct update are both refused)", async () => {
      const { data: draft } = await superAdmin.from("results").select("id").eq("status", "published").limit(1).single();
      const rpc = await centralStaff.rpc("set_results_publication", { p_ids: [draft!.id], p_publish: false });
      expect(rpc.error?.message).toMatch(/Only authorized central roles/);
      const direct = await centralStaff.from("results").update({ status: "unpublished" }).eq("id", draft!.id);
      expect(direct.error?.message).toMatch(/Only authorized central roles/);
    });

    it("only super/central admins can read the audit log", async () => {
      expect((await centralStaff.from("audit_logs").select("id").limit(1)).data).toHaveLength(0);
      expect((await superAdmin.from("audit_logs").select("id").limit(1)).data).toHaveLength(1);
    });

    it("profiles cannot be created through the API (sign-up is server-only)", async () => {
      const { error } = await superAdmin.from("profiles").insert({ id: crypto.randomUUID(), role: "super_admin" });
      expect(error).not.toBeNull();
    });
  });
});

describe.skipIf(!dbAvailable)("CMS URL safety (database constraint)", () => {
  it("rejects javascript: links even when written directly through the API", async () => {
    const admin = await as(SUPER);
    const { error } = await admin.from("notices").insert({ title_en: "XSS attempt", attachment_url: "javascript:alert(1)" });
    expect(error?.message).toMatch(/notices_attachment_safe/);
    const { error: menuError } = await admin.from("menu_items").insert({ location: "header", label_en: "x", href: "javascript:alert(1)" });
    expect(menuError?.message).toMatch(/menu_items_href_safe/);
  });
});
