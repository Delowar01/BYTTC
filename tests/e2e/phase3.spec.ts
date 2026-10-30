import { expect, test, type Page } from "@playwright/test";
import { autoAcceptDialogs, login, PASSWORD, resetRateLimit, uid } from "./helpers";

const MAILPIT = "http://127.0.0.1:54324";

async function issueForSeedExam(page: Page) {
  await page.goto("/admin/certificates");
  await page.getByLabel("Exam").selectOption({ label: "COA-2026-JUN — Computer Office Application — Final (Jun 2026)" });
  await page.getByRole("button", { name: "Issue certificates" }).click();
  await expect(page.getByRole("status").filter({ hasText: /certificate\(s\) issued/ })).toBeVisible();
}

test("certificates: issue → PDF with QR → public verify → reissue → revoke", async ({ page }) => {
  autoAcceptDialogs(page, "E2E certificate correction");
  await resetRateLimit("certificate_verify");
  await login(page);
  await issueForSeedExam(page);

  // Seed student 200001 (Sadia Islam) passed COA-2026-JUN
  await page.goto("/admin/certificates?q=200001");
  const row = page.getByRole("row", { name: /Sadia Islam/ }).filter({ hasText: "valid" });
  await expect(row).toBeVisible();
  const certNo = (await row.getByRole("cell").first().innerText()).trim();
  expect(certNo).toMatch(/^STTN-\d{2}-[0-9A-Z]{8}$/);

  // PDF is a real PDF that contains the certificate number and the verify link
  const pdfHref = await row.getByRole("link", { name: "PDF" }).getAttribute("href");
  const pdf = await page.request.get(pdfHref!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const body = await pdf.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  // lib entry avoids pdf-parse's debug mode under ESM
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const text = (await pdfParse(body)).text;
  expect(text).toContain(certNo);
  expect(text).toContain("Sadia Islam");
  expect(text).toContain(`/verify?no=${certNo}`);

  // Public verification (as the QR code link)
  await page.goto(`/lang?to=en&next=${encodeURIComponent(`/verify?no=${certNo}`)}`);
  await expect(page.getByTestId("cert-status")).toHaveText("This certificate is authentic and valid.");
  await expect(page.getByTestId("cert-card")).toContainText("Sadia Islam");

  // Reissue (correction) → old one shows revoked + pointer to the new number
  await page.goto("/admin/certificates?q=200001&status=valid");
  await page.getByRole("row", { name: new RegExp(certNo) }).getByRole("button", { name: "Reissue" }).click();
  const reissued = page.getByRole("status").filter({ hasText: "Reissued as" });
  await expect(reissued).toBeVisible();
  const newNo = (await reissued.innerText()).match(/STTN-\d{2}-[0-9A-Z]{8}/)![0];
  await page.goto(`/verify?no=${certNo}`);
  await expect(page.getByTestId("cert-status")).toContainText("REVOKED");
  await expect(page.getByTestId("cert-superseded")).toContainText(newNo);

  // Revoke the new one → verification reports revoked; PDF carries a REVOKED watermark
  await page.goto(`/admin/certificates?q=${newNo}`);
  await page.getByRole("row", { name: new RegExp(newNo) }).getByRole("button", { name: "Revoke" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Certificate ${newNo} revoked.` })).toBeVisible();
  await page.goto(`/verify?no=${newNo}`);
  await expect(page.getByTestId("cert-status")).toContainText("REVOKED");
  await page.goto(`/admin/certificates?q=${newNo}`);
  const revokedHref = await page.getByRole("row", { name: new RegExp(newNo) }).getByRole("link", { name: "PDF" }).getAttribute("href");
  expect((await pdfParse(await (await page.request.get(revokedHref!)).body())).text).toContain("REVOKED");

  // Audit trail recorded the revocation reason
  await page.goto("/admin/audit?table=certificates");
  await expect(page.getByRole("cell", { name: "E2E certificate correction" }).first()).toBeVisible();
});

test("password reset by email: request → email link → new password → sign in", async ({ page, request }) => {
  await resetRateLimit("password_reset");
  const email = "central.staff@example.org";
  const newPassword = `Reset${uid()}x9A`;
  await request.delete(`${MAILPIT}/api/v1/messages`);

  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByTestId("reset-sent")).toBeVisible();

  // Unknown emails get the same answer (no account enumeration)
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("nobody@example.org");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByTestId("reset-sent")).toBeVisible();

  let link = "";
  await expect(async () => {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    expect(list.messages.length).toBeGreaterThan(0);
    const msg = await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
    link = (msg.HTML as string).match(/href="([^"]+\/auth\/confirm[^"]+)"/)![1].replaceAll("&amp;", "&");
  }).toPass({ timeout: 20_000 });
  expect(link).toContain("type=recovery");

  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel(/^New password/).fill(newPassword);
  await page.getByLabel(/^Confirm new password/).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  await expect(page.getByTestId("reset-done")).toBeVisible();

  // The link is single-use
  await page.goto(link.replace(/^https?:\/\/[^/]+/, ""));
  await expect(page).toHaveURL(/forgot-password\?expired=1/);

  await login(page, email, newPassword);
  // restore the shared test password for other tests
  await page.goto("/admin/account");
  await page.getByLabel("Current password").fill(newPassword);
  await page.getByLabel(/^New password/).fill(PASSWORD);
  await page.getByLabel("Confirm new password").fill(PASSWORD);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed.")).toBeVisible();
});

test("reports, results export and tabulation sheet", async ({ page }) => {
  await login(page);
  await page.goto("/admin/reports");
  const examRow = page.getByTestId("report-exams").getByRole("row", { name: /COA-2026-JUN/ });
  await expect(examRow).toBeVisible();
  await expect(examRow).toContainText("%");
  await expect(page.getByTestId("report-institutes")).toContainText("DHK-001");
  const report = await page.request.get("/admin/reports/export");
  expect(report.headers()["content-type"]).toContain("spreadsheetml");

  await page.goto("/admin/results");
  await page.getByLabel("Exam").selectOption({ label: "COA-2026-JUN" });
  await page.getByRole("button", { name: "Filter" }).click();
  const xlsx = await page.request.get((await page.getByRole("link", { name: "Excel" }).getAttribute("href"))!);
  expect(xlsx.headers()["content-type"]).toContain("spreadsheetml");
  await page.getByRole("link", { name: "Tabulation sheet" }).click();
  await expect(page.getByText(/Tabulation sheet — Computer Office Application/)).toBeVisible();
  await expect(page.getByTestId("tabulation-summary")).toContainText("published");
});

test("institute users get only their own figures in reports and exports", async ({ page }) => {
  await login(page, "dhk.admin@example.org");
  await page.goto("/admin/reports");
  await expect(page.getByTestId("report-institutes")).toContainText("DHK-001");
  await expect(page.getByTestId("report-institutes")).not.toContainText("CTG-001");
  const csv = await (await page.request.get("/admin/results/export?format=csv")).text();
  const lines = csv.trim().split("\n").slice(1);
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every((l) => l.includes(",DHK-001,"))).toBe(true);
});

test("private student documents: upload, signed link, institute isolation", async ({ page, browser }) => {
  await login(page, "dhk.staff@example.org");
  await page.goto("/admin/students?q=200001"); // seed roll 200001 belongs to CTG-001: invisible to DHK
  await expect(page.getByRole("cell", { name: "200001" })).toHaveCount(0);
  await page.goto("/admin/students");
  await page.getByRole("link", { name: "Open" }).first().click();
  await expect(page).toHaveURL(/\/admin\/students\/[0-9a-f-]{36}/);
  await page.getByLabel("Document file").setInputFiles({ name: `nid-${uid()}.pdf`, mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await page.getByRole("button", { name: "Upload" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Document uploaded." })).toBeVisible();
  await page.reload();
  const link = page.getByTestId("student-documents").getByRole("link").first();
  const href = (await link.getAttribute("href"))!;
  const signed = await page.request.get(href, { maxRedirects: 0 });
  expect(signed.status()).toBe(302);
  expect(signed.headers()["location"]).toContain("token=");

  // Another institute cannot open it, and anonymous users are rejected
  const other = await browser.newPage();
  await login(other, "ctg.admin@example.org");
  expect((await other.request.get(href, { maxRedirects: 0 })).status()).toBe(404);
  await other.close();
  const anonymous = await browser.newContext();
  const anon = await anonymous.request.get(`http://localhost:3000${href}`, { maxRedirects: 0 });
  expect(anon.status()).toBe(307); // proxy sends anonymous users to the login page
  expect(anon.headers()["location"]).toContain("/login");
  await anonymous.close();
});
