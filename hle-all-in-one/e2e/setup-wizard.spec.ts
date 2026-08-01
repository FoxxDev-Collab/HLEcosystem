import { expect, test } from "@playwright/test"

// First-run setup wizard (ADR-0006). Runs in its own dependency-free project
// ("setup-wizard") because the shared auth.setup cannot log in against an
// empty database. Self-skipping on both preconditions:
//  - the instance must be uninitialized (a normal seeded dev/e2e DB isn't →
//    /setup redirects to /login and the test skips), and
//  - SETUP_TOKEN must be provided so the token step can be driven.
//
// Live run recipe (fresh throwaway DB):
//   createdb + migrate, then
//   SETUP_TOKEN=<x> bun .output/server/index.mjs
//   SETUP_TOKEN=<x> PW_BASE_URL=... bunx playwright test --project=setup-wizard
test.use({ storageState: { cookies: [], origins: [] } })

const TOKEN = process.env.SETUP_TOKEN

test("first run walks through token → admin → household → signed in", async ({
  page,
}) => {
  test.skip(!TOKEN, "SETUP_TOKEN not provided")

  await page.goto("/setup")
  test.skip(
    !new URL(page.url()).pathname.startsWith("/setup"),
    "instance already initialized"
  )

  // Step 1 — a wrong token must be rejected at submit time.
  await page.getByLabel("Setup token").fill("definitely-wrong")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("First name").fill("Wizard")
  await page.getByLabel("Last name").fill("Admin")
  await page.getByLabel("Email").fill("wizard-admin@e2e.local")
  await page.getByLabel("Password", { exact: true }).fill("Wizard-Pass-123!")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Household name").fill("Wizard Household")
  await page.getByRole("button", { name: "Finish setup" }).click()
  await expect(page.getByText(/Invalid setup token/)).toBeVisible()

  // Fix the token and finish for real.
  await page.getByRole("button", { name: "Back" }).click()
  await page.getByRole("button", { name: "Back" }).click()
  await page.getByLabel("Setup token").fill(TOKEN as string)
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: "Finish setup" }).click()

  // Lands authenticated in the shell — no second login step.
  await page.waitForURL((url) => !url.pathname.startsWith("/setup"))
  await expect(page.locator("h1").first()).toBeVisible()

  // The wizard is now dead: /setup bounces to /login for a fresh visitor.
  const fresh = await page.context().browser()!.newContext()
  const freshPage = await fresh.newPage()
  await freshPage.goto(`${test.info().project.use.baseURL}/setup`)
  await freshPage.waitForURL((url) => url.pathname.startsWith("/login"))
  await fresh.close()
})
