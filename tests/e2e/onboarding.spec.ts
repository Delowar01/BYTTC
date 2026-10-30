import { expect, test } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { autoAcceptDialogs, login, resetRateLimit, uid } from "./helpers";

const MINIMAL_PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF";

test("institute onboarding: apply → approve → activate → register → marks → submit → publish → public", async ({ page, browser }) => {
  test.setTimeout(180_000);
  autoAcceptDialogs(page);
  await resetRateLimit("institute_application");
  await resetRateLimit("result_lookup");
  const tag = uid();
  const instName = `E2E Training Institute ${tag}`;
  const adminEmail = `inst-${tag.toLowerCase()}@example.org`;
  const tempPassword = `Temp${tag}pass1`;
  const newPassword = `New${tag}Secure9`;

  // 1. Public online application with a private supporting document
  const doc = path.join(os.tmpdir(), `licence-${tag}.pdf`);
  fs.writeFileSync(doc, MINIMAL_PDF);
  await page.goto("/lang?to=en&next=/apply");
  await page.getByLabel("Institute name (English) *").fill(instName);
  await page.getByLabel("Head of institute *").fill("Head Person");
  await page.getByLabel("District *").fill("Cumilla");
  await page.getByLabel("Phone *").first().fill("+880 1700-111111");
  await page.getByLabel("Email *").first().fill("office@example.org");
  await page.getByLabel("Address *").fill("1 Test Road, Cumilla");
  await page.getByLabel("Computer Office Application").check();
  await page.getByLabel("Your name *").fill("Applicant Person");
  await page.getByLabel("Phone *").nth(1).fill("+880 1700-222222");
  await page.getByLabel("Email *").nth(1).fill(adminEmail);
  await page.getByLabel(/Supporting documents/).setInputFiles(doc);
  await page.getByRole("button", { name: "Submit application" }).click();
  await expect(page.getByTestId("application-sent")).toBeVisible();
  const reference = await page.getByTestId("application-ref").innerText();
  expect(reference).toMatch(/^APP-[0-9A-F]{8}$/);

  // Not public while pending
  await page.goto(`/institutes?q=${tag}`);
  await expect(page.getByText(instName)).toHaveCount(0);

  // 2. Central review: document, code, course assignment, approval, account activation
  await login(page);
  await page.goto(`/admin/institutes?q=${reference}`);
  await page.getByRole("link", { name: "Manage" }).click();
  await expect(page.getByText("Online application")).toBeVisible();
  await expect(page.getByText("Requested courses: COA")).toBeVisible();
  const docLink = page.getByRole("link", { name: /licence/ });
  const docResponse = await page.request.get((await docLink.getAttribute("href"))!, { maxRedirects: 0 });
  expect(docResponse.status()).toBe(302); // signed URL redirect, staff only

  const code = `E2E-${tag}`;
  await page.getByLabel("Institute code").fill(code);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Institute saved.")).toBeVisible();
  await page.getByLabel("COA — Computer Office Application").check();
  await page.getByRole("button", { name: "Save assignments" }).click();
  await expect(page.getByText("Course assignments saved (1 course).")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Institute approved.")).toBeVisible();
  await page.reload();
  const accountForm = page.locator("form", { has: page.getByRole("button", { name: "Create account" }) });
  await expect(accountForm.getByLabel("Email")).toHaveValue(adminEmail); // prefilled from application
  await accountForm.getByLabel("Temporary password").fill(tempPassword);
  await accountForm.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Account created.")).toBeVisible();

  // 3. Institute admin signs in, changes password, registers a student
  const inst = await browser.newPage();
  inst.on("dialog", (d) => d.accept());
  await login(inst, adminEmail, tempPassword);
  await inst.goto("/admin/account");
  await inst.getByLabel("Current password").fill(tempPassword);
  await inst.getByLabel(/^New password/).fill(newPassword);
  await inst.getByLabel("Confirm new password").fill(newPassword);
  await inst.getByRole("button", { name: "Change password" }).click();
  await expect(inst.getByText("Password changed.")).toBeVisible();

  await inst.goto("/admin/institutes");
  await expect(inst).toHaveURL(/denied=1/); // central-only page

  await inst.goto("/admin/students/new");
  await expect(inst.getByLabel("Course").locator("option")).toHaveText(["Select…", "COA — Computer Office Application"]);
  await inst.getByLabel("Course").selectOption({ label: "COA — Computer Office Application" });
  await inst.getByLabel("Session").selectOption({ label: "July–December 2026" });
  await inst.getByLabel("Name (English)").fill(`Onboarded Student ${tag}`);
  await inst.getByRole("button", { name: "Save" }).click();
  await expect(inst.getByText("Student saved.")).toBeVisible();
  const roll = await inst.getByLabel("Roll number").inputValue();
  const registration = await inst.getByLabel("Registration number").inputValue();

  // The tenant sees only its own student
  await inst.goto("/admin/students");
  await expect(inst.getByRole("row")).toHaveCount(2); // header + 1

  // 4. Marks entry → submit for review (cannot publish)
  await inst.goto("/admin/results/entry");
  await inst.getByLabel("Exam").selectOption({ label: "COA-2026-DEC — Computer Office Application — Final (Dec 2026)" });
  await inst.getByRole("button", { name: "Load students" }).click();
  await inst.getByLabel(`Theory ${roll}`).fill("70");
  await inst.getByRole("button", { name: "Save marks as draft" }).click();
  await expect(inst.getByText("2 mark(s) need attention. Nothing was saved.")).toBeVisible();
  await expect(inst.getByText("Exceeds full marks (60)")).toBeVisible();
  await expect(inst.getByText("Marks are required")).toBeVisible(); // practical left blank
  await inst.getByLabel(`Theory ${roll}`).fill("50");
  await inst.getByLabel(`Practical ${roll}`).fill("30");
  await inst.getByRole("button", { name: "Save marks as draft" }).click();
  await expect(inst.getByText("Saved: 1 new, 0 updated (drafts).")).toBeVisible();
  await inst.reload();
  await inst.getByRole("button", { name: "Submit for central review" }).click();
  await expect(inst.getByText("1 result(s) submitted for central review.")).toBeVisible();
  await inst.goto("/admin/results");
  await expect(inst.getByRole("button", { name: "Publish" })).toHaveCount(0);
  await inst.close();

  // 5. Central publishes the submitted result
  await page.goto(`/admin/results?status=submitted&q=${roll}`);
  await page.getByLabel(`Select ${roll}`).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByText("1 result(s) published.")).toBeVisible();

  // 6. Public sees the institute and the result
  await page.goto(`/lang?to=en&next=/institutes?q=${tag}`);
  await expect(page.getByText(instName)).toBeVisible();
  await page.goto("/results");
  await page.getByLabel("Roll number").fill(roll);
  await page.getByLabel("Registration number").fill(registration);
  await page.getByRole("button", { name: "Show result" }).click();
  const card = page.getByTestId("result-card");
  await expect(card).toContainText(instName);
  await expect(card.getByTestId("result-grade")).toContainText("A+"); // 80/100
});

test("institute admin manages only their own staff", async ({ page }) => {
  await login(page, "dhk.admin@example.org");
  await page.goto("/admin/users");
  await expect(page.getByText("Staff accounts of your institute.")).toBeVisible();
  await expect(page.getByRole("cell", { name: "superadmin@example.org" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "ctg.admin@example.org" })).toHaveCount(0);
  const email = `dhk-staff-${uid().toLowerCase()}@example.org`;
  await page.goto("/admin/users/new");
  await expect(page.getByLabel("Role")).toHaveCount(0); // role is fixed to staff
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Full name").fill("New DHK Staff");
  await page.getByLabel("Temporary password").fill("StaffPass123");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("User created.")).toBeVisible();
  await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("Institute Staff");
  await expect(page.getByRole("row", { name: new RegExp(email) })).toContainText("DHK-001");
});
