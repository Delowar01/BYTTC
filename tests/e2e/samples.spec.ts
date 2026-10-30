import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// The files in samples/ are handed to testers; keep them in sync with the seed data.
async function validate(page: Page, uploadPath: string, file: string) {
  await page.goto(uploadPath);
  await page.getByLabel(/Spreadsheet file/).setInputFiles(file);
  await page.getByRole("button", { name: "Upload and validate" }).click();
  await expect(page).toHaveURL(/\/admin\/imports\/[0-9a-f-]{36}/);
}

async function discard(page: Page) {
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByTestId("flash")).toHaveText("Batch discarded.");
}

test("sample import files validate exactly as documented", async ({ page }) => {
  await login(page);

  await validate(page, "/admin/results/import", "samples/results-import-valid.xlsx");
  await expect(page.getByTestId("valid-rows")).toHaveText("6");
  await expect(page.getByTestId("error-rows")).toHaveText("0");
  await expect(page.getByRole("button", { name: "Commit 6 results as draft" })).toBeVisible();
  await discard(page);

  await validate(page, "/admin/results/import", "samples/results-import-with-errors.xlsx");
  await expect(page.getByTestId("valid-rows")).toHaveText("1");
  await expect(page.getByTestId("error-rows")).toHaveText("6");
  const issues = page.getByTestId("issues-table");
  for (const msg of ["Exceeds full marks (60)", "Registration number does not match", "Duplicate: roll 200045", "No student with this roll number", "Student is not registered at this institute", "Unknown exam code"]) {
    await expect(issues).toContainText(msg);
  }
  await expect(page.getByRole("button", { name: /^Commit/ })).toHaveCount(0);
  await discard(page);

  await validate(page, "/admin/students/import", "samples/students-import-sample.xlsx");
  await expect(page.getByTestId("valid-rows")).toHaveText("3");
  await expect(page.getByTestId("error-rows")).toHaveText("0");
  await discard(page);
});
