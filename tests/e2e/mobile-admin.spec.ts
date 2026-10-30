import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("admin console is usable on a phone", async ({ page }) => {
  await login(page);
  for (const path of ["/admin", "/admin/students", "/admin/results", "/admin/results/import", "/admin/imports", "/admin/certificates", "/admin/reports", "/admin/cms/pages"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${path} overflows horizontally`).toBe(false);
  }
  // Navigation is behind the menu button on small screens
  await page.goto("/admin");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Student list" }).click();
  await expect(page).toHaveURL(/\/admin\/students$/);
});
