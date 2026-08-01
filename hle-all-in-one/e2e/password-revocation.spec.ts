import { expect, test } from "@playwright/test"
import type { Browser, BrowserContext, Page } from "@playwright/test"

// REGRESSION — credential-change session revocation (IA-5 / AC-12).
//
// v1 pre-release finding: changing a password left every other active
// session valid for the rest of its 30 days, defeating the main reason a
// password gets changed. Now: a self-service change revokes every OTHER
// session (the changing one stays), and an admin reset revokes ALL of the
// target's sessions.
//
// Runs as: admin (project storageState) provisions a throwaway user; two
// fresh contexts sign in as that user; one changes the password; the other
// must be dead. Then the admin resets the password and the survivor must be
// dead too. The user is deleted at the end, pass or fail.

const ts = Date.now()
const EMAIL = `e2e-revoke-${ts}@e2e.local`
const PW_INITIAL = "Revoke-Me-1234!"
const PW_ROTATED = "Rotated-Away-5678!"
const PW_ADMIN_RESET = "Admin-Reset-9012!"

const contexts: Array<BrowserContext> = []

async function newSignedInPage(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: undefined,
  })
  contexts.push(context)
  const page = await context.newPage()
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  return page
}

function userRow(page: Page) {
  return page.locator("tr", { hasText: EMAIL })
}

async function deleteThrowawayUser(page: Page) {
  await page.goto("/manager/members")
  const row = userRow(page)
  if ((await row.count()) === 0) return
  await row.getByRole("button", { name: "Delete" }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  await expect(userRow(page)).toHaveCount(0)
}

test.afterAll(async () => {
  for (const c of contexts) await c.close()
})

test("password change and admin reset revoke the right sessions", async ({
  page,
  browser,
}) => {
  // Admin provisions the throwaway user through the real dialog.
  await page.goto("/manager/members")
  await page.getByRole("button", { name: "Add user" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("First name").fill("E2E")
  await dialog.getByLabel("Last name").fill(`Revoke${ts}`)
  await dialog.getByLabel("Email").fill(EMAIL)
  await dialog.getByLabel("Password", { exact: true }).fill(PW_INITIAL)
  await dialog.getByRole("button", { name: "Create user" }).click()
  await expect(userRow(page)).toHaveCount(1)

  try {
    // Two live sessions for the same user.
    const sessionA = await newSignedInPage(browser, EMAIL, PW_INITIAL)
    const sessionB = await newSignedInPage(browser, EMAIL, PW_INITIAL)

    // Session A rotates the password.
    await sessionA.goto("/manager/security")
    await sessionA.getByLabel("Current password").fill(PW_INITIAL)
    await sessionA.getByLabel("New password").fill(PW_ROTATED)
    await sessionA.getByRole("button", { name: "Update password" }).click()
    await expect(sessionA.getByText("Password updated.")).toBeVisible()

    // Session B is dead: any authenticated navigation lands on /login.
    await sessionB.goto("/manager/security")
    await sessionB.waitForURL((url) => url.pathname.startsWith("/login"))

    // Session A survived its own change.
    await sessionA.goto("/manager/security")
    await expect(sessionA.locator("h1").first()).toBeVisible()
    expect(new URL(sessionA.url()).pathname.startsWith("/login")).toBe(false)

    // Admin resets the password → ALL of the target's sessions die.
    await page.goto("/manager/members")
    await userRow(page).getByRole("button", { name: "Set password" }).click()
    const pwDialog = page.getByRole("dialog")
    await pwDialog.getByLabel("New password").fill(PW_ADMIN_RESET)
    await pwDialog.getByRole("button", { name: "Set password" }).click()
    await expect(pwDialog.getByText("Password updated.")).toBeVisible()
    await pwDialog.getByRole("button", { name: "Done" }).click()

    await sessionA.goto("/manager/security")
    await sessionA.waitForURL((url) => url.pathname.startsWith("/login"))
  } finally {
    await deleteThrowawayUser(page)
  }
})
