import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { autoAcceptDialogs, login, uid } from "./helpers";

/** Synthetic (fictional) portrait for photo-upload tests. */
async function syntheticPhoto() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#cfe3e0"/><circle cx="200" cy="190" r="90" fill="#7a9e99"/><rect x="80" y="310" width="240" height="190" rx="90" fill="#7a9e99"/></svg>`;
  return sharp(Buffer.from(svg)).webp().toBuffer();
}

test("student with passport + photo → single result → draft → publish → correction with reason and displayed date", async ({ page }) => {
  autoAcceptDialogs(page);
  await login(page);
  const tag = uid();
  const name = `Academic Test ${tag}`;
  const passport = `EB${tag}`.slice(0, 12);

  // Create the student with the new fields
  await page.goto("/admin/students/new");
  await page.getByLabel("Institute").selectOption({ label: "DHK-001 — Dhaka Model Technical Institute" });
  await page.getByLabel("Course").selectOption({ label: "COA — Computer Office Application" });
  await page.getByLabel("Session").selectOption({ label: "July–December 2026" });
  await page.getByLabel("Name (English)").fill(name);
  await page.getByLabel("Father's name").fill("Test Father");
  await page.getByLabel("Mother's name").fill("Test Mother");
  await page.getByLabel("Thana / upazila").fill("Test Thana");
  await page.getByLabel("District", { exact: true }).fill("Test District");
  await page.getByLabel(/^Passport number/).fill(passport);
  await page.getByLabel("Passing year").fill("2026");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Student saved.")).toBeVisible();
  await expect(page.getByLabel(/^Passport number/)).toHaveValue(passport);
  const roll = await page.getByLabel("Roll number").inputValue();

  // Photo: WebP upload is normalized and shown
  await page.getByLabel("Photo file").setInputFiles({ name: "portrait.webp", mimeType: "image/webp", buffer: await syntheticPhoto() });
  await page.getByRole("button", { name: "Upload photo" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Photo saved." })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("student-photo")).toBeVisible();
  // Invalid photo type is rejected
  await page.getByLabel("Photo file").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not an image") });
  await page.getByRole("button", { name: "Replace photo" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Use a JPG, PNG or WebP photo." })).toBeVisible();

  // Single result: find the student, preview, save as draft
  await page.goto(`/admin/results/new?q=${roll}`);
  await page.getByRole("link", { name: "Select" }).click();
  await page.getByLabel("Examination").selectOption({ label: "COA-2026-DEC — Computer Office Application — Final (Dec 2026)" });
  await page.getByLabel(/^Written \/ theory/).fill("50");
  await page.getByLabel(/^Practical/).fill("30");
  await expect(page.getByTestId("result-preview")).toContainText("80 / 100");
  await expect(page.getByTestId("result-preview")).toContainText("A+");
  await page.getByRole("button", { name: "Save as draft" }).click();
  await expect(page.getByText("Result saved as draft.")).toBeVisible();
  const resultUrl = page.url().split("?")[0];

  // Duplicate prevention points to the existing result
  await page.goto(`/admin/results/new?q=${roll}`);
  await page.getByRole("link", { name: "Select" }).click();
  await page.getByLabel("Examination").selectOption({ label: "COA-2026-DEC — Computer Office Application — Final (Dec 2026) — result exists" });
  await expect(page.getByRole("link", { name: "Edit result" })).toHaveAttribute("href", resultUrl.replace(/^https?:\/\/[^/]+/, ""));

  // Publish, then correct with reason and a displayed publication date
  await page.goto(resultUrl);
  await page.getByRole("button", { name: "Publish result" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Result published." })).toBeVisible();
  await page.reload();
  await page.getByLabel(/^Written\/theory marks/).fill("55");
  await page.getByLabel("Displayed publication date").fill("2026-12-30");
  // A reason is mandatory for published results (browser + server + database enforce it)
  await expect(page.getByLabel(/^Reason for correction/)).toHaveAttribute("required", "");
  await page.getByLabel(/^Reason for correction/).fill("Re-checked written script");
  await page.getByRole("button", { name: "Save correction" }).click();
  await expect(page.getByText("Result updated. Totals and grade recalculated.")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("result-summary")).toContainText("Total 85 / 100");
  await expect(page.getByTestId("display-date")).toHaveText("2026-12-30");
  await expect(page.getByRole("cell", { name: "Re-checked written script" }).first()).toBeVisible();

  // Corrections view lists it
  await page.goto(`/admin/results?corrected=1&q=${roll}`);
  await expect(page.getByRole("cell", { name: roll, exact: true })).toBeVisible();
});

test("grading scales page shows 5.00 and 4.00 scales with version history controls", async ({ page }) => {
  await login(page);
  await page.goto("/admin/grading");
  await expect(page.getByText("GPA 5.00 scale")).toBeVisible();
  await expect(page.getByText("CGPA 4.00 scale")).toBeVisible();
  await page.goto("/admin/exams/new");
  await expect(page.getByLabel("Viva full marks (0 = no viva)")).toBeVisible();
  await expect(page.getByLabel("Grading scale")).toContainText("CGPA 4.00 scale");
});
