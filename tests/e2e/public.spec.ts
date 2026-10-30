import { expect, test, type Page } from "@playwright/test";
import { resetRateLimit } from "./helpers";

async function sendContact(page: Page, n = 1) {
  await page.goto("/lang?to=en&next=/contact");
  await page.getByLabel("Your name *").fill(`E2E Visitor ${n}`);
  await page.getByLabel("Email").fill("visitor@example.org");
  await page.getByLabel("Message *").fill("Is admission open for the web design course?");
  await page.getByRole("button", { name: "Send message" }).click();
}

test.describe("Public website", () => {
  test.beforeEach(() => resetRateLimit("result_lookup"));

  test("is bilingual: Bangla by default, English on switch", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "bn");
    await expect(page.getByText("সর্বশেষ নোটিশ")).toBeVisible();
    await page.goto("/lang?to=en&next=/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByText("Latest notices")).toBeVisible();
    await expect(page.getByTestId("disclaimer")).toContainText("do not imply government accreditation");
  });

  test("every main page loads without horizontal overflow", async ({ page }) => {
    for (const p of ["/", "/about", "/courses", "/courses/COA", "/notices", "/institutes", "/results", "/verify", "/contact", "/p/privacy"]) {
      const res = await page.goto(p);
      expect(res?.status(), p).toBe(200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${p} overflows horizontally`).toBe(false);
    }
  });

  test("result search shows a published result with public fields only", async ({ page }) => {
    await page.goto("/lang?to=en&next=/results");
    await page.getByLabel("Roll number").fill("200001");
    await page.getByLabel("Registration number").fill("2600000001");
    await page.getByRole("button", { name: "Show result" }).click();
    const card = page.getByTestId("result-card").first();
    await expect(card).toBeVisible();
    await expect(card).toContainText("Sadia Islam");
    await expect(card).not.toContainText("Father");
    await expect(card).not.toContainText("1800-");
  });

  test("result search rejects a wrong registration number", async ({ page }) => {
    await page.goto("/lang?to=en&next=/results");
    await page.getByLabel("Roll number").fill("200001");
    await page.getByLabel("Registration number").fill("2600000002");
    await page.getByRole("button", { name: "Show result" }).click();
    await expect(page.getByTestId("result-not-found")).toBeVisible();
  });

  test("certificate verification reports unknown numbers", async ({ page }) => {
    await page.goto("/verify?no=STTN-0000-FAKE");
    await expect(page.getByTestId("cert-not-found")).toBeVisible();
  });

  test("verified institutes directory lists approved institutes only", async ({ page }) => {
    await page.goto("/lang?to=en&next=/institutes");
    await expect(page.getByText("Dhaka Model Technical Institute")).toBeVisible();
    await expect(page.getByText("Sylhet Career Institute")).toHaveCount(0); // pending
    await expect(page.getByText("Khulna Polytech Training Point")).toHaveCount(0); // suspended
  });

  test("contact form stores a message", async ({ page }) => {
    await resetRateLimit("contact");
    await sendContact(page);
    await expect(page.getByTestId("contact-sent")).toBeVisible();
  });

  test("contact form is rate limited per client (5 per hour)", async ({ page }) => {
    await resetRateLimit("contact");
    for (let i = 1; i <= 5; i++) {
      await sendContact(page, i);
      await expect(page.getByTestId("contact-sent")).toBeVisible();
    }
    await sendContact(page, 6);
    await expect(page.getByText("Too many attempts")).toBeVisible();
    await resetRateLimit("contact");
  });
});
