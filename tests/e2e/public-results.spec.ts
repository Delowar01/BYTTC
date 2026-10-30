import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { localService, login, resetRateLimit } from "./helpers";

// Seed student 200002 (fictional) has a published result for COA-2026-JUN.
const ROLL = "200002";
const REG = "2600000002";
const PASSPORT = "QA7788990";
let studentId = "";

test.beforeAll(async () => {
  const db = localService();
  const { data: s } = await db.from("students").select("id, institute_id").eq("roll_no", ROLL).single();
  studentId = s!.id;
  const photo = await sharp({ create: { width: 300, height: 380, channels: 3, background: "#8fb3ae" } }).jpeg().toBuffer();
  const path = `institutes/${s!.institute_id}/students/${studentId}/photo/e2e.jpg`;
  await db.storage.from("private-documents").upload(path, photo, { contentType: "image/jpeg", upsert: true });
  await db.from("students").update({ passport_no: PASSPORT, photo_path: path, date_of_birth: "2003-05-17" }).eq("id", studentId);
  await db.from("site_settings").update({ public_show_photo: true, public_show_parents: true, public_show_dob: true }).eq("id", 1);
});

test.afterAll(async () => {
  const db = localService();
  await db.from("site_settings").update({ public_show_photo: false, public_show_parents: false, public_show_dob: false }).eq("id", 1);
  await db.from("students").update({ passport_no: null, photo_path: null }).eq("id", studentId);
});

test.beforeEach(async () => {
  await resetRateLimit("result_lookup");
  await resetRateLimit("result_sheet");
});

async function search(page: Page, method: string, first: string, second: string) {
  await page.goto("/lang?to=en&next=/results");
  await page.getByText(method, { exact: true }).click();
  await page.locator("#first").fill(first);
  await page.locator("#second").fill(second);
  await page.getByRole("button", { name: "Show result" }).click();
  await expect(page.getByTestId("result-card").or(page.getByTestId("result-not-found")).first()).toBeVisible();
}

test("expanded public result: photo, consented details, detailed marks — never the passport", async ({ page }) => {
  await search(page, "Roll + Registration", ROLL, REG);
  const card = page.getByTestId("result-card").filter({ hasText: "Final (Jun 2026)" });
  await expect(card.getByTestId("result-photo")).toBeVisible();
  await expect(card.getByTestId("result-details")).toContainText("Father Hossain"); // seed father name
  await expect(card.getByTestId("result-details")).toContainText("17 May 2003");
  await expect(card.getByTestId("result-details")).toContainText("6 Months");
  await expect(card.getByTestId("marks-table")).toContainText("Written");
  await expect(card.getByTestId("marks-table")).toContainText("N/A"); // exam without viva
  await expect(page.locator("body")).not.toContainText(PASSPORT);
});

test("passport-based searches need a second matching identifier", async ({ page }) => {
  await search(page, "Passport + Roll", PASSPORT.toLowerCase(), ROLL);
  await expect(page.getByTestId("result-card").first()).toBeVisible();
  await search(page, "Passport + Registration", PASSPORT, REG);
  await expect(page.getByTestId("result-card").first()).toBeVisible();
  await search(page, "Passport + Roll", PASSPORT, "200001"); // someone else's roll
  await expect(page.getByTestId("result-not-found")).toBeVisible();
  await search(page, "Passport + Registration", "ZZ0000000", REG);
  await expect(page.getByTestId("result-not-found")).toBeVisible();
  await expect(page).not.toHaveURL(new RegExp(PASSPORT));
});

test("result sheet PDF download and its QR verification", async ({ page }) => {
  await search(page, "Passport + Roll", PASSPORT, ROLL);
  const card = page.getByTestId("result-card").filter({ hasText: "Final (Jun 2026)" });
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "Download result sheet" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^result-sheet-200002-COA-2026-JUN\.pdf$/);
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const text = (await pdfParse((await import("node:fs")).readFileSync((await file.path())!))).text;
  expect(text).toContain("Tanvir Hossain");
  expect(text).toContain("Detailed Marks");
  expect(text).not.toContain(PASSPORT);
  expect(page.url()).not.toContain(PASSPORT);
  const code = /code ([0-9A-Z]{12})/.exec(text)![1];
  await page.goto(`/verify?r=${code}&v=1`);
  await expect(page.getByTestId("result-verify-status")).toContainText(/authentic|out of date/);
});

test("admin marksheet: single and bulk PDF", async ({ page }) => {
  await login(page);
  await page.goto(`/admin/results?q=${ROLL}`);
  await page.getByRole("link", { name: ROLL, exact: true }).first().click();
  const single = await page.request.get((await page.getByRole("link", { name: "Download marksheet" }).getAttribute("href"))!);
  expect(single.headers()["content-type"]).toBe("application/pdf");
  await page.goto("/admin/results");
  await page.getByLabel("Exam").selectOption({ label: "COA-2026-JUN" });
  await page.getByRole("button", { name: "Filter" }).click();
  const bulkHref = await page.getByRole("link", { name: /Marksheets/ }).first().getAttribute("href");
  const bulk = await page.request.get(bulkHref!);
  expect(bulk.headers()["content-type"]).toBe("application/pdf");
  const { PDFDocument } = await import("pdf-lib");
  expect((await PDFDocument.load(await bulk.body())).getPageCount()).toBeGreaterThanOrEqual(10);
});
