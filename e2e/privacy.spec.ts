import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const ARTIFACTS = "/opt/cursor/artifacts";

test.beforeAll(async () => {
  await mkdir(ARTIFACTS, { recursive: true });
});

test("home links to a privacy policy that matches what the game stores", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const link = page.getByRole("link", { name: "Privacy policy" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "/privacy");
  await link.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${ARTIFACTS}/privacy_link_desktop.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await link.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${ARTIFACTS}/privacy_link_mobile.png` });

  await link.click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
  await expect(page.getByText("Sam Vere Design").first()).toBeVisible();
  const mail = page.getByRole("link", { name: "samveredesign@gmail.com" });
  await expect(mail.first()).toBeVisible();
  await expect(mail).toHaveCount(4);
  for (const link of await mail.all()) {
    await expect(link).toHaveAttribute("href", "mailto:samveredesign@gmail.com");
  }
  await expect(page.getByText("[OPERATOR NAME]")).toHaveCount(0);
  await expect(page.getByText("[CONTACT EMAIL]")).toHaveCount(0);
  await expect(page.getByText(/more than 7 days earlier/)).toBeVisible();
  await expect(page.getByRole("link", { name: "ico.org.uk" })).toHaveAttribute("href", "https://ico.org.uk");
  await page.screenshot({ path: `${ARTIFACTS}/privacy_page.png`, fullPage: true });
});
