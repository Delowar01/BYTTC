import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { autoAcceptDialogs, login, resetRateLimit, uid } from "./helpers";

// Synthetic seed students enrolled in course COA (see supabase/seed.sql)
const STUDENTS = [
  ["200045", "2600000045", "DHK-001"],
  ["200046", "2600000046", "CTG-001"],
  ["200047", "2600000047", "RAJ-001"],
  ["200054", "2600000054", "DHK-001"],
];
const HEADERS = ["roll_no", "registration_no", "student_name", "institute_code", "course_code", "exam_code", "theory_marks", "practical_marks", "remarks"];

async function writeXlsx(rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Results");
  ws.addRow(HEADERS);
  rows.forEach((r) => ws.addRow(r));
  const file = path.join(os.tmpdir(), `results-${uid()}-${Math.random().toString(36).slice(2)}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

async function upload(page: Page, file: string) {
  await page.goto("/admin/results/import");
  await page.getByLabel(/Spreadsheet file/).setInputFiles(file);
  await page.getByRole("button", { name: "Upload and validate" }).click();
  await expect(page).toHaveURL(/\/admin\/imports\/[0-9a-f-]{36}/);
}

async function publicLookup(page: Page, roll: string, reg: string) {
  await page.goto("/lang?to=en&next=/results");
  await page.getByLabel("Roll number").fill(roll);
  await page.getByLabel("Registration number").fill(reg);
  await page.getByRole("button", { name: "Show result" }).click();
  await expect(page.getByTestId("result-card").or(page.getByTestId("result-not-found")).first()).toBeVisible();
}

test("bulk result upload: validate → commit as draft → publish → public → unpublish → rollback", async ({ page }) => {
  autoAcceptDialogs(page, "E2E rollback");
  await resetRateLimit("result_lookup");
  await login(page);
  const code = `E2E-${uid()}`;
  const examName = `E2E Exam ${code}`;

  // Create the exam through the UI
  await page.goto("/admin/exams/new");
  await page.getByLabel("Exam code").fill(code);
  await page.getByLabel("Name").fill(examName);
  await page.getByLabel("Course").selectOption({ label: "COA — Computer Office Application" });
  await page.getByLabel("Session").selectOption({ label: "July–December 2026" });
  await page.getByLabel("Theory full marks").fill("60");
  await page.getByLabel("Practical full marks").fill("40");
  await page.getByLabel("Pass marks (out of total)").fill("40");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Exam saved.")).toBeVisible();

  // Template download is a real workbook with reference sheets
  const dl = page.waitForEvent("download");
  await page.goto("/admin/results/import");
  await page.getByRole("link", { name: /Excel template/ }).click();
  const template = new ExcelJS.Workbook();
  await template.xlsx.readFile((await (await dl).path())!);
  expect(template.worksheets.map((w) => w.name)).toEqual(["Results", "Instructions", "Exams", "Institutes"]);
  expect((template.getWorksheet("Results")!.getRow(1).values as string[]).slice(1)).toEqual(HEADERS);
  const examCodes = template.getWorksheet("Exams")!.getColumn(1).values.slice(2);
  expect(examCodes).toContain(code);

  // 1) A file with errors is previewed and cannot be committed
  const bad = await writeXlsx([
    [STUDENTS[0][0], STUDENTS[0][1], "", STUDENTS[0][2], "COA", code, 50, 30, ""], // valid
    [STUDENTS[1][0], STUDENTS[1][1], "", STUDENTS[1][2], "COA", code, 75, 30, ""], // theory > 60
    [STUDENTS[2][0], "0000000000", "", STUDENTS[2][2], "COA", code, 40, 20, ""], // wrong registration
    [STUDENTS[0][0], STUDENTS[0][1], "", STUDENTS[0][2], "COA", code, 45, 30, ""], // duplicate
  ]);
  await upload(page, bad);
  await expect(page.getByTestId("error-rows")).toHaveText("3");
  await expect(page.getByTestId("valid-rows")).toHaveText("1");
  await expect(page.getByTestId("issues-table")).toContainText("Exceeds full marks (60)");
  await expect(page.getByTestId("issues-table")).toContainText("Registration number does not match");
  await expect(page.getByTestId("issues-table")).toContainText("Duplicate: roll 200045");
  await expect(page.getByRole("button", { name: /^Commit/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByTestId("flash")).toHaveText("Batch discarded.");

  // 2) A valid file commits as draft
  const good = await writeXlsx(STUDENTS.map(([roll, reg, inst], i) => [roll, reg, "", inst, "COA", code, 40 + i * 5, 20 + i * 5, ""]));
  await upload(page, good);
  await expect(page.getByTestId("error-rows")).toHaveText("0");
  await page.getByRole("button", { name: "Commit 4 results as draft" }).click();
  await expect(page.getByTestId("flash")).toHaveText("4 results saved as draft.");
  await expect(page.getByTestId("batch-status")).toHaveText("committed");
  const batchUrl = page.url().split("?")[0];

  // Drafts are NOT public
  await publicLookup(page, STUDENTS[3][0], STUDENTS[3][1]);
  await expect(page.getByText(examName)).toHaveCount(0);

  // 3) Publish → visible publicly with computed grade
  await page.goto(batchUrl);
  await page.getByRole("button", { name: "Publish results" }).click();
  await expect(page.getByTestId("flash")).toHaveText("4 results published.");
  await publicLookup(page, STUDENTS[3][0], STUDENTS[3][1]); // 55 + 35 = 90 → A+
  const card = page.getByTestId("result-card").filter({ hasText: examName });
  await expect(card).toBeVisible();
  await expect(card.getByTestId("result-grade")).toContainText("A+");
  await expect(card.getByTestId("result-verdict")).toHaveText("Passed");

  // 4) Unpublish → hidden; rollback (with reason) → removed
  await page.goto(batchUrl);
  await page.getByRole("button", { name: "Unpublish results" }).click();
  await expect(page.getByTestId("flash")).toHaveText("4 results unpublished.");
  await publicLookup(page, STUDENTS[3][0], STUDENTS[3][1]);
  await expect(page.getByText(examName)).toHaveCount(0);
  await page.goto(batchUrl);
  await page.getByRole("button", { name: "Roll back batch" }).click();
  await expect(page.getByTestId("flash")).toHaveText("Rolled back: 4 results removed.");

  // Original file is retained privately and downloadable by staff
  const orig = page.waitForEvent("download");
  await page.getByRole("link", { name: "Original file" }).click();
  expect((await orig).suggestedFilename()).toMatch(/\.xlsx$/);

  // Audit trail recorded the rollback reason
  await page.goto("/admin/audit?table=results");
  await expect(page.getByRole("cell", { name: "E2E rollback" }).first()).toBeVisible();

  // Cleanup: the exam has no results left and can be deleted
  await page.goto("/admin/exams");
  await page.getByRole("row", { name: new RegExp(code) }).getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Deleted.")).toBeVisible();
});

test("bulk student import: preview then create", async ({ page }) => {
  await login(page);
  const tag = uid();
  const csv = [
    "institute_code,course_code,session,roll_no,registration_no,name_en,date_of_birth,gender,phone",
    `RAJ-001,WEB,July–December 2026,E2E${tag}A,,Imported One ${tag},2003-01-15,male,+880 1900-000001`,
    `RAJ-001,WEB,July–December 2026,,,Imported Two ${tag},2004-11-02,female,`,
  ].join("\n");
  const file = path.join(os.tmpdir(), `students-${tag}.csv`);
  fs.writeFileSync(file, csv);

  await page.goto("/admin/students/import");
  await page.getByLabel(/Spreadsheet file/).setInputFiles(file);
  await page.getByRole("button", { name: "Upload and validate" }).click();
  await expect(page.getByTestId("valid-rows")).toHaveText("2");
  await expect(page.getByTestId("error-rows")).toHaveText("0");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Create 2 students" }).click();
  await expect(page.getByTestId("flash")).toHaveText("2 students created.");

  await page.goto(`/admin/students?q=${tag}`);
  await expect(page.getByRole("cell", { name: `E2E${tag}A` })).toBeVisible();
  await expect(page.getByText(`Imported Two ${tag}`)).toBeVisible();
});
