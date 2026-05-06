import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const authFile = path.join(__dirname, "..", "playwright", ".auth", "user.json");

setup("authenticate ADMIN_DEV", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD ?? "";
  if (!email) {
    throw new Error("Defina E2E_ADMIN_EMAIL (p. ej. en apps/web/.env.e2e.local).");
  }
  if (!password) {
    throw new Error("Defina E2E_ADMIN_PASSWORD.");
  }

  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /iniciar sesión/i }).click();

  await expect(page.locator("#login-error")).toBeHidden({ timeout: 20_000 });
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 25_000 });

  fs.mkdirSync(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
