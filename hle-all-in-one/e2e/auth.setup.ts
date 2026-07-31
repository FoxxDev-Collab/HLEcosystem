import process from "node:process"
import { expect, test as setup } from "@playwright/test"

const STORAGE_STATE = "e2e/.auth/state.json"

// Must match scripts/seed.ts — same env var, same default — so a freshly
// seeded database is always loggable by the suite.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@hle.local"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!"

// Logs in once through the real login form and saves the session cookie
// so every other test starts authenticated.
setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill(ADMIN_EMAIL)
  await page.getByLabel("Password").fill(ADMIN_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()

  // Successful login navigates to "/" (the authenticated shell).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  await expect(page.locator("h1").first()).toBeVisible()

  await page.context().storageState({ path: STORAGE_STATE })
})
