import { expect, test } from "@playwright/test";
import { autoAcceptDialogs, login, PASSWORD, uid } from "./helpers";

test.describe("Super Admin console", () => {
  test("rejects a wrong password and protects /admin", async ({ page }) => {
    await page.goto("/admin/students");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Fstudents/);
    await page.getByLabel("Email").fill("superadmin@example.org");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
  });

  test("dashboard shows live counts", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByTestId("stat-Students")).toHaveText(/^\d+$/);
    expect(Number(await page.getByTestId("stat-Students").innerText())).toBeGreaterThanOrEqual(60);
  });

  test("course CRUD is reflected on the public website", async ({ page }) => {
    autoAcceptDialogs(page);
    await login(page);
    const code = `E2E${uid()}`;
    await page.goto("/admin/courses/new");
    await page.getByLabel("Course code").fill(code);
    await page.getByLabel("Title (English)").fill(`E2E Welding ${code}`);
    await page.getByLabel("Title (Bangla)").fill("ওয়েল্ডিং");
    await page.getByLabel("Duration (months)").fill("3");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Course saved.")).toBeVisible();

    await page.goto(`/courses/${code}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/ওয়েল্ডিং|E2E Welding/);

    await page.goto(`/admin/courses?q=${code}`);
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Deleted.")).toBeVisible();
    const res = await page.goto(`/courses/${code}`);
    expect(res?.status()).toBe(404);
  });

  test("validation errors are shown inline", async ({ page }) => {
    await login(page);
    await page.goto("/admin/courses/new");
    await page.getByLabel("Course code").fill("bad code!");
    await page.getByLabel("Title (English)").fill("X");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText(/letters, digits or dashes/)).toBeVisible();
    await expect(page.getByLabel("Title (English)")).toHaveValue("X"); // input preserved
  });

  test("student create, search, export and delete", async ({ page }) => {
    autoAcceptDialogs(page);
    await login(page);
    const name = `E2E Student ${uid()}`;
    await page.goto("/admin/students/new");
    await page.getByLabel("Institute").selectOption({ label: "DHK-001 — Dhaka Model Technical Institute" });
    await page.getByLabel("Course").selectOption({ label: "COA — Computer Office Application" });
    await page.getByLabel("Session").selectOption({ label: "July–December 2026" });
    await page.getByLabel("Name (English)").fill(name);
    await page.getByLabel("Date of birth").fill("2005-03-14");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Student saved.")).toBeVisible();
    const roll = await page.getByLabel("Roll number").inputValue();
    expect(roll).toMatch(/^\d{6,}$/);
    expect(await page.getByLabel("Registration number").inputValue()).toMatch(/^\d{10}$/);

    await page.goto(`/admin/students?q=${encodeURIComponent(name)}`);
    await expect(page.getByRole("cell", { name: roll })).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV" }).click();
    const file = await (await download).path();
    const csv = (await import("node:fs")).readFileSync(file, "utf8");
    expect(csv).toContain(name);
    expect(csv.split("\n")[0]).not.toContain("national_id");

    await page.goto(`/admin/students?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name: "Open" }).click();
    await page.getByRole("button", { name: "Delete student" }).click();
    await expect(page).toHaveURL(/deleted=1/);
  });

  test("institute approval workflow controls the public directory", async ({ page }) => {
    autoAcceptDialogs(page, "Inspection pending");
    await login(page);
    const code = `E2E-${uid()}`;
    const name = `E2E Polytechnic ${code}`;
    await page.goto("/admin/institutes/new");
    await page.getByLabel("Institute code").fill(code);
    await page.getByLabel("Name (English)").fill(name);
    await page.getByLabel("District").fill("Bogura");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Institute saved.")).toBeVisible();
    await expect(page.getByText("pending", { exact: true })).toBeVisible();

    await page.goto(`/institutes?q=${code}`);
    await expect(page.getByText(name)).toHaveCount(0);

    await page.goBack();
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("Institute approved.")).toBeVisible();
    await page.goto(`/institutes?q=${code}`);
    await expect(page.getByText(name)).toBeVisible();

    await page.goBack();
    await page.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByText("Institute suspended.")).toBeVisible();
    await page.goto(`/institutes?q=${code}`);
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test("CMS edits appear on the public site", async ({ page }) => {
    await login(page);
    await page.goto("/admin/cms/pages");
    await page.getByRole("row", { name: /About Us/ }).getByRole("link", { name: "Edit" }).click();
    const marker = `E2E marker ${uid()}`;
    const body = page.getByLabel(/^Body \(English/);
    const original = await body.inputValue();
    await body.fill(`${original}\n\n${marker}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Page saved.")).toBeVisible();

    await page.goto("/lang?to=en&next=/about");
    await expect(page.getByText(marker)).toBeVisible();

    await page.goto("/admin/cms/pages");
    await page.getByRole("row", { name: /About Us/ }).getByRole("link", { name: "Edit" }).click();
    await page.getByLabel(/^Body \(English/).fill(original);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Page saved.")).toBeVisible();
  });

  test("institute staff cannot open central-only pages", async ({ page }) => {
    await login(page, "dhk.staff@example.org", PASSWORD);
    await page.goto("/admin/institutes");
    await expect(page).toHaveURL(/denied=1/);
    await expect(page.getByText("You do not have permission")).toBeVisible();
    await page.goto("/admin/students");
    await expect(page.getByText("Students of your institute.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "CTG-001" })).toHaveCount(0);
  });
});
