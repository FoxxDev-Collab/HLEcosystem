import { expect, test as setup } from "@playwright/test"

const STORAGE_STATE = "e2e/.auth/state.json"

// Logs in once through the real login form and saves the session cookie
// so every other test starts authenticated.
setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.getByLabel("Email").fill("admin@hle.local")
  await page.getByLabel("Password").fill("changeme123")
  await page.getByRole("button", { name: "Sign in" }).click()

  // Successful login navigates to "/" (the authenticated shell).
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  await expect(page.locator("h1").first()).toBeVisible()

  await page.context().storageState({ path: STORAGE_STATE })
})
