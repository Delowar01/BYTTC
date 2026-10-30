import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin console is usable on a phone", async ({ page }) => {
  await login(page);
  for (const path of ["/admin", "/admin/students", "/admin/results", "/admin/results/import", "/admin/imports", "/admin/certificates", "/admin/marksheets", "/admin/admit-cards", "/admin/registration-cards", "/admin/templates", "/admin/reports", "/admin/cms/pages"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${path} overflows horizontally`).toBe(false);
  }
  // The template editor scrolls its canvas instead of widening the page
  await page.goto("/admin/templates");
  await page.getByRole("link", { name: /^(Edit|View)$/ }).first().click();
  await expect(page.getByTestId("template-canvas")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), "template editor overflows horizontally").toBe(false);
  // Navigation is behind the menu button on small screens
  await page.goto("/admin");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Student list" }).click();
  await expect(page).toHaveURL(/\/admin\/students$/);
});
