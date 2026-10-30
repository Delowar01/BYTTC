import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { autoAcceptDialogs, localService, login, resetRateLimit, uid } from "./helpers";

const COA = "22222222-0000-4000-8000-000000000001";
const SESSION_JUL = "33333333-0000-4000-8000-000000000002";
const DHK = "11111111-0000-4000-8000-000000000001";

/** Synthetic blank design (own artwork: border and corner ornaments only, no text or seals). */
async function blankDesign(w: number, h: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fbf7ec"/><rect x="40" y="40" width="${w - 80}" height="${h - 80}" fill="none" stroke="#2f5d8a" stroke-width="14"/><rect x="70" y="70" width="${w - 140}" height="${h - 140}" fill="none" stroke="#c9a54a" stroke-width="4"/><circle cx="110" cy="110" r="18" fill="#c9a54a"/><circle cx="${w - 110}" cy="${h - 110}" r="18" fill="#c9a54a"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Synthetic single-page PDF design with an identifying caption (our own artwork). */
async function blankPdfDesign(caption: string) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawRectangle({ x: 20, y: 20, width: 555, height: 801, borderColor: rgb(0.2, 0.36, 0.54), borderWidth: 6 });
  page.drawText(caption, { x: 40, y: 40, size: 8, color: rgb(0.5, 0.5, 0.5) });
  return Buffer.from(await doc.save());
}

/** Create a draft of `type` from the built-in layout and upload a design for it. */
async function draftWithDesign(page: Page, type: string, name: string, file: { name: string; mimeType: string; buffer: Buffer }, orientation: string) {
  await page.goto("/admin/templates");
  await page.getByLabel("Document type").selectOption(type);
  await page.getByLabel("Template name").fill(name);
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}$/);
  await page.getByLabel(/^Blank design/).setInputFiles(file);
  await page.getByRole("button", { name: "Upload design" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Design uploaded (${orientation})` })).toBeVisible();
  return page.url();
}

async function activate(page: Page, type: string, name: string) {
  await page.goto("/admin/templates");
  await page.getByTestId(`templates-${type}`).getByRole("row", { name: new RegExp(name) }).getByRole("button", { name: "Activate" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Template activated" })).toBeVisible();
}

async function syntheticSignature() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="140"><path d="M20 100 C80 20 120 140 180 60 S280 120 380 40" fill="none" stroke="#1d2a6b" stroke-width="6"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function pdfText(page: Page, href: string) {
  const res = await page.request.get(href);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  return pdfParse(await res.body());
}

/** Local test DB: put the seeded template of a type back in charge. */
async function restoreTemplate(type: string, name: string) {
  const db = localService();
  await db.from("document_templates").update({ status: "archived" }).eq("doc_type", type).eq("status", "active").neq("name", name);
  await db.from("document_templates").update({ status: "active" }).eq("doc_type", type).eq("name", name);
}

test.describe("academic documents", () => {
  test.afterAll(async () => {
    await restoreTemplate("admit_card", "Standard admit card");
    await restoreTemplate("registration_card", "Standard registration card");
    await restoreTemplate("marksheet", "Standard result sheet");
    await localService().from("document_templates").update({ status: "archived" }).eq("doc_type", "certificate").eq("status", "active");
  });

  test("admit card template: upload design → drag fields → signature → activate → issue → verify → reissue → revoke", async ({ page }) => {
    autoAcceptDialogs(page, "E2E document correction");
    await resetRateLimit("certificate_verify");
    const tag = uid();
    const db = localService();
    const { data: exam } = await db
      .from("exams")
      .insert({ code: `E2E-AC-${tag}`, name: `Admit card test ${tag}`, course_id: COA, session_id: SESSION_JUL, exam_date: "2026-12-20", exam_time: "10:00 AM", venue: "Hall E2E" })
      .select("id")
      .single();
    await login(page);

    // New draft from the built-in admit card layout
    await page.goto("/admin/templates");
    await page.getByLabel("Document type").selectOption("admit_card");
    await page.getByLabel("Template name").fill(`E2E admit ${tag}`);
    await page.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}$/);
    const templateUrl = page.url();
    await expect(page.getByTestId("template-canvas")).toBeVisible();

    // Upload a blank PNG design: orientation follows the design
    await page.getByLabel(/^Blank design/).setInputFiles({ name: "blank-design.png", mimeType: "image/png", buffer: await blankDesign(1754, 1240) });
    await page.getByRole("button", { name: "Upload design" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Design uploaded (landscape)" })).toBeVisible();
    await expect(page.getByTestId("template-canvas").locator("img").first()).toBeVisible();
    await expect(page.getByLabel("Orientation")).toHaveValue("landscape");

    // Drag the QR code to a new position (percentage coordinates update)
    const qr = page.locator('[data-field-id="qr"]');
    const box = (await qr.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2 + 20, { steps: 6 });
    await page.mouse.up();
    const x = Number(await page.getByLabel("X (%)").inputValue());
    expect(x).toBeLessThan(80);
    await expect(page.getByTestId("unsaved")).toBeVisible();
    // Resize with the corner handle
    const before = Number(await page.getByLabel("Size (% of width)").inputValue());
    const handle = (await page.getByTestId("resize-handle").boundingBox())!;
    await page.mouse.move(handle.x + 3, handle.y + 3);
    await page.mouse.down();
    await page.mouse.move(handle.x + 40, handle.y + 3, { steps: 4 });
    await page.mouse.up();
    expect(Number(await page.getByLabel("Size (% of width)").inputValue())).toBeGreaterThan(before);

    // Add a text field with a data token and style it
    await page.getByRole("button", { name: "Add text" }).click();
    await page.getByLabel("Text (use {tokens} for data)").fill("Exam centre: {venue}");
    await page.getByLabel("Font size (pt)").fill("14");
    await page.getByLabel("Bold").check();
    await expect(page.getByTestId("template-canvas")).toContainText("Exam centre: Sample Technical Institute, Hall 2");

    // Signature image (saves the current layout together with the image)
    await page.getByLabel(/^Signature or stamp image/).setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: await syntheticSignature() });
    await page.getByRole("button", { name: "Add image" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Image added to the layout" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Signature / stamp image" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Exam centre: [Venue]" })).toBeVisible();
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Template saved." })).toBeVisible();

    // Preview with synthetic data
    const preview = await pdfText(page, `${templateUrl}/preview`);
    expect(preview.text).toContain("SAMPLE");
    expect(preview.text).toContain("Exam centre: Sample Technical Institute, Hall 2");

    // Activate (the standard template is archived)
    await page.goto("/admin/templates");
    await page.getByTestId("templates-admit_card").getByRole("row", { name: new RegExp(`E2E admit ${tag}`) }).getByRole("button", { name: "Activate" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Template activated" })).toBeVisible();
    await expect(page.getByTestId("templates-admit_card").getByRole("row", { name: /Standard admit card/ })).toContainText("archived");

    // Issue admit cards for the exam
    await page.goto(`/admin/admit-cards?exam=${exam!.id}`);
    await page.getByRole("button", { name: /^Issue admit cards \(\d+\)$/ }).click();
    await expect(page.getByRole("status").filter({ hasText: /admit card\(s\) issued/ })).toBeVisible();
    const row = page.getByTestId("document-row").first();
    await expect(row).toBeVisible();
    const docNo = (await row.getByRole("cell").first().innerText()).trim();
    const card = await pdfText(page, (await row.getByRole("link", { name: "PDF" }).getAttribute("href"))!);
    expect(card.text).toContain(docNo);
    expect(card.text).toContain("Exam centre: Hall E2E");
    expect(card.text).toContain("10:00 AM");
    const bulk = await page.getByRole("link", { name: "Download all" }).getAttribute("href");
    expect((await pdfText(page, bulk!)).numpages).toBeGreaterThan(1);

    // Public verification
    await page.goto(`/lang?to=en&next=${encodeURIComponent(`/verify?no=${docNo}`)}`);
    await expect(page.getByTestId("doc-status")).toHaveAttribute("data-status", "valid");
    await expect(page.getByTestId("doc-card")).toContainText("Admit card");

    // Reissue with a corrected seat → old one superseded
    await page.goto(`/admin/admit-cards?exam=${exam!.id}&q=${docNo}`);
    await page.getByRole("link", { name: docNo }).click();
    await expect(page).toHaveURL(/\/admin\/documents\/[0-9a-f-]{36}$/);
    await page.getByLabel("Seat number").fill("Z-9");
    await page.getByLabel("Reason for reissue (audited)").fill("Seat changed");
    await page.getByRole("button", { name: "Reissue", exact: true }).click();
    await expect(page).toHaveURL(/reissued=1/);
    await expect(page.getByTestId("document-facts")).toContainText("Z-9");
    await expect(page.getByTestId("document-facts")).toContainText(docNo); // "Replaces"
    const newNo = (await page.getByRole("heading", { level: 1 }).innerText()).split(" ").pop()!;
    await page.goto(`/verify?no=${docNo}`);
    await expect(page.getByTestId("doc-status")).toHaveAttribute("data-status", "superseded");
    await expect(page.getByTestId("doc-superseded")).toContainText(newNo);

    // Revoke the new one
    await page.goto(`/admin/admit-cards?exam=${exam!.id}&q=${newNo}`);
    await page.getByTestId("document-row").getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Document ${newNo} revoked.` })).toBeVisible();
    await page.goto(`/verify?no=${newNo}`);
    await expect(page.getByTestId("doc-status")).toHaveAttribute("data-status", "revoked");

    // Institute isolation: an institute admin sees only its own cards and cannot issue
    const { data: ctgDoc } = await db.from("documents").select("id").eq("exam_id", exam!.id).neq("institute_id", DHK).limit(1).single();
    const inst = await page.context().browser()!.newPage();
    await login(inst, "dhk.admin@example.org");
    await inst.goto(`/admin/admit-cards?exam=${exam!.id}`);
    const rows = inst.getByTestId("document-row");
    await expect(rows.first()).toBeVisible();
    for (const text of await rows.allInnerTexts()) expect(text).toContain("DHK-001");
    await expect(inst.getByRole("button", { name: /^Issue admit cards/ })).toHaveCount(0);
    expect((await inst.request.get(`/admin/documents/${ctgDoc!.id}/pdf`)).status()).toBe(404);
    await inst.close();
  });

  test("registration cards: bulk issue with validity → bulk PDF → expiry shows on verification", async ({ page }) => {
    autoAcceptDialogs(page);
    await resetRateLimit("certificate_verify");
    const db = localService();
    const { data: dhkStudents } = await db.from("students").select("id").eq("course_id", COA).eq("session_id", SESSION_JUL).eq("institute_id", DHK).eq("status", "active");
    await db.from("documents").update({ status: "revoked", revoke_reason: "E2E reset" }).eq("doc_type", "registration_card").eq("status", "valid").in("student_id", dhkStudents!.map((s) => s.id));
    await login(page);
    const jpg = await sharp(await blankDesign(1240, 1754)).jpeg({ quality: 85 }).toBuffer();
    const tag = uid();
    await draftWithDesign(page, "registration_card", `E2E registration ${tag}`, { name: "design.jpg", mimeType: "image/jpeg", buffer: jpg }, "portrait");
    await activate(page, "registration_card", `E2E registration ${tag}`);
    await page.goto("/admin/registration-cards");
    await expect(page.getByText(`Active template: E2E registration ${tag} v1`)).toBeVisible();
    await page.getByLabel("Course").selectOption({ label: "COA — Computer Office Application" });
    await page.getByLabel("Session").selectOption({ label: "July–December 2026" });
    await page.getByLabel("Institute").selectOption({ label: "DHK-001 — Dhaka Model Technical Institute" });
    await page.getByRole("button", { name: "Filter" }).click();
    await page.getByLabel("Valid until (optional)").fill("2031-06-30");
    await page.getByRole("button", { name: `Issue registration cards (${dhkStudents!.length})` }).click();
    await expect(page.getByRole("status").filter({ hasText: `${dhkStudents!.length} registration card(s) issued` })).toBeVisible();

    const bulk = await pdfText(page, (await page.getByRole("link", { name: "Download all" }).getAttribute("href"))!);
    expect(bulk.numpages).toBe(dhkStudents!.length);
    expect(bulk.text).toContain("REGISTRATION CARD");
    expect(bulk.text).toContain("valid until 30 June 2031");

    const docNo = (await page.getByTestId("document-row").first().getByRole("cell").first().innerText()).trim();
    await page.goto(`/lang?to=en&next=${encodeURIComponent(`/verify?no=${docNo}`)}`);
    await expect(page.getByTestId("doc-status")).toHaveAttribute("data-status", "valid");
    await expect(page.getByTestId("doc-card")).toContainText("30 Jun 2031");
    await db.from("documents").update({ valid_until: "2025-01-01" }).eq("document_no", docNo);
    await page.reload();
    await expect(page.getByTestId("doc-status")).toHaveAttribute("data-status", "expired");
    await expect(page.getByTestId("doc-status")).toHaveText("This document has EXPIRED.");
  });

  test("certificate template: duplicate → edit → activate → reissued certificate uses it; old one still verifies", async ({ page }) => {
    autoAcceptDialogs(page, "E2E template rollout");
    await resetRateLimit("certificate_verify");
    const tag = uid();
    await login(page);
    await page.goto("/admin/templates");
    await page.getByTestId("templates-certificate").getByRole("row", { name: /Standard certificate \(template\)/ }).getByRole("button", { name: "Duplicate" }).click();
    await expect(page).toHaveURL(/\/admin\/templates\/[0-9a-f-]{36}$/);
    await page.getByLabel(/^Blank design/).setInputFiles({ name: "certificate-design.png", mimeType: "image/png", buffer: await blankDesign(1754, 1240) });
    await page.getByRole("button", { name: "Upload design" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Design uploaded (landscape)" })).toBeVisible();
    await page.getByLabel("Template name").fill(`E2E certificate ${tag}`);
    await page.getByRole("button", { name: "CERTIFICATE", exact: true }).click();
    await page.getByLabel("Text (use {tokens} for data)").fill("CERTIFICATE OF COMPLETION");
    await page.getByRole("button", { name: "Save template" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Template saved." })).toBeVisible();
    await page.goto("/admin/templates");
    await page.getByTestId("templates-certificate").getByRole("row", { name: new RegExp(`E2E certificate ${tag}`) }).getByRole("button", { name: "Activate" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Template activated" })).toBeVisible();

    // Issue (if needed) and reissue a certificate for seed student 200001
    await page.goto("/admin/certificates");
    await page.getByLabel("Exam", { exact: true }).selectOption({ label: "COA-2026-JUN — Computer Office Application — Final (Jun 2026)" });
    await page.getByRole("button", { name: "Issue certificates" }).click();
    await expect(page.getByRole("status").filter({ hasText: /certificate\(s\) issued/ })).toBeVisible();
    await page.goto("/admin/certificates?q=200001&status=valid");
    const oldNo = (await page.getByRole("row", { name: /Sadia Islam/ }).first().getByRole("cell").first().innerText()).trim();
    await page.getByRole("row", { name: new RegExp(oldNo) }).getByRole("button", { name: "Reissue" }).click();
    const reissued = page.getByRole("status").filter({ hasText: "Reissued as" });
    await expect(reissued).toBeVisible();
    const newNo = (await reissued.innerText()).match(/[A-Z0-9]+-\d{2}-[0-9A-Z]{8}/)![0];

    await page.goto(`/admin/certificates?q=${newNo}`);
    const href = await page.getByRole("row", { name: new RegExp(newNo) }).getByRole("link", { name: "PDF" }).getAttribute("href");
    const cert = await pdfText(page, href!);
    expect(cert.text).toContain("CERTIFICATE OF COMPLETION");
    expect(cert.text).toContain(newNo);
    expect(cert.text).toContain("Sadia Islam");

    await page.goto(`/lang?to=en&next=${encodeURIComponent(`/verify?no=${newNo}`)}`);
    await expect(page.getByTestId("cert-status")).toHaveText("This certificate is authentic and valid.");
    await page.goto(`/verify?no=${oldNo}`);
    await expect(page.getByTestId("cert-superseded")).toContainText(newNo);
  });

  test("marksheet template: uploaded PDF design is used for marksheet downloads", async ({ page }) => {
    autoAcceptDialogs(page);
    const tag = uid();
    await login(page);
    await draftWithDesign(page, "marksheet", `E2E marksheet ${tag}`, { name: "marksheet-design.pdf", mimeType: "application/pdf", buffer: await blankPdfDesign(`E2E BLANK MARKSHEET DESIGN ${tag}`) }, "portrait");
    await expect(page.getByTestId("template-canvas")).toContainText("PDF design");
    await activate(page, "marksheet", `E2E marksheet ${tag}`);
    await page.goto("/admin/marksheets");
    await page.getByLabel("Exam").selectOption({ label: "COA-2026-JUN — Computer Office Application — Final (Jun 2026)" });
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByTestId("bulk-marksheets")).toContainText("published result(s)");
    const sheet = await pdfText(page, (await page.getByRole("link", { name: "PDF" }).first().getAttribute("href"))!);
    expect(sheet.text).toContain(`E2E BLANK MARKSHEET DESIGN ${tag}`);
    expect(sheet.text).toContain("Detailed Marks");
    const bulk = await pdfText(page, (await page.getByTestId("bulk-marksheets").getByRole("link").first().getAttribute("href"))!);
    expect(bulk.numpages).toBeGreaterThan(1);
    expect(bulk.text).toContain(`E2E BLANK MARKSHEET DESIGN ${tag}`);
  });
});
