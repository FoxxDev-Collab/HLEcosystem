import { expect, test } from "@playwright/test"

// REGRESSION — login brute-force throttle (AC-7). Six wrong passwords for one
// email must flip the response from "Invalid email or password." to a lockout
// message, without revealing whether the email exists.
//
// Uses a NONEXISTENT probe email on purpose: the throttle keys on the
// submitted string either way, and probing the real seed admin would lock the
// suite's own login for 15 minutes. The lock lives in app-process memory, so
// restarting the container resets it — no cleanup needed here.
test.use({ storageState: { cookies: [], origins: [] } })

const PROBE_EMAIL = "throttle-probe@e2e.local"

test("locks an email after repeated failed logins", async ({ page }) => {
  await page.goto("/login")

  for (let i = 0; i < 5; i++) {
    await page.getByLabel("Email").fill(PROBE_EMAIL)
    await page.getByLabel("Password").fill(`wrong-password-${i}!`)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Invalid email or password.")).toBeVisible()
  }

  // Sixth attempt: throttled before any password check.
  await page.getByLabel("Email").fill(PROBE_EMAIL)
  await page.getByLabel("Password").fill("wrong-password-final!")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText(/Too many failed attempts/)).toBeVisible()

  // Other emails are untouched — the throttle is per-principal, not global.
  await page.getByLabel("Email").fill("someone-else@e2e.local")
  await page.getByLabel("Password").fill("wrong-password!")
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page.getByText("Invalid email or password.")).toBeVisible()
})
