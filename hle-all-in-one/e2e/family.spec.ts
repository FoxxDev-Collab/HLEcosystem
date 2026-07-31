import { expect, test } from "@playwright/test"
import type { Browser, BrowserContext, Page } from "@playwright/test"

// A full "test family" lifecycle against the real (shared dev) database:
// an admin provisions two accounts, the parent builds a household and fills
// three modules with data, the kid signs in and sees all of it, and neither
// of them can see the admin household's data — the ADR-0005 tenancy boundary.
// Every entity carries the same `ts` marker so any leftover is identifiable.
const ts = Date.now()

const PARENT_EMAIL = `parent-${ts}@e2e.local`
const KID_EMAIL = `kid-${ts}@e2e.local`
// Both satisfy the policy in src/lib/password.ts: 12+ chars, upper, lower,
// digit, symbol. The Create/Set password buttons stay disabled otherwise.
const PARENT_PASSWORD = "E2eParent!2026"
const KID_PASSWORD = "E2eKid!2026x"

const HOUSEHOLD = `E2E Family ${ts}`

// Data the parent creates inside the family household (three non-media
// modules): hub person, finance account, meals store.
const PERSON_FIRST = "Family"
const PERSON_LAST = `Person${ts}`
const PERSON = `${PERSON_FIRST} ${PERSON_LAST}`
const ACCOUNT = `E2E Family Account ${ts}`
const STORE = `E2E Family Store ${ts}`

// Data the admin creates inside ITS own household — must stay invisible to
// the family, and the family's data must stay invisible to the admin.
const MARKER_FIRST = "Isolation"
const MARKER_LAST = `Marker${ts}`
const MARKER = `${MARKER_FIRST} ${MARKER_LAST}`

// Contexts for the non-admin identities. The "chromium" project's
// storageState is the seed admin, so parent/kid each need a fresh context
// logged in through the real form.
const contexts: Array<BrowserContext> = []
let parentPage: Page
let kidPage: Page
// Read off the sidebar once the admin is signed in — never hard-coded, so the
// isolation assertions hold whatever the seed household is called.
let adminHouseholdName = ""

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: "Sign in" }).click()
  await page.waitForURL((url) => !url.pathname.startsWith("/login"))
  await expect(page.locator("h1").first()).toBeVisible()
}

async function newSignedInPage(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  // Manually created contexts do not inherit the project's `use` options, so
  // baseURL is passed through explicitly and storageState left empty.
  const context = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    storageState: undefined,
  })
  contexts.push(context)
  const page = await context.newPage()
  await signIn(page, email, password)
  return page
}

// The household switcher lives in the sidebar header dropdown.
function householdTrigger(page: Page) {
  return page.locator('[data-slot="sidebar-header"] button').first()
}

function sidebarNav(page: Page) {
  return page.locator('[data-slot="sidebar-content"]').first()
}

async function ensureActiveHousehold(page: Page, name: string) {
  const trigger = householdTrigger(page)
  await expect(trigger).toBeVisible()
  if ((await trigger.innerText()).includes(name)) return
  await trigger.click()
  await page.getByRole("menuitem", { name }).click()
  await expect(
    trigger,
    `sidebar should show "${name}" as the active household`
  ).toContainText(name)
}

async function activeHouseholdName(page: Page): Promise<string> {
  const trigger = householdTrigger(page)
  await expect(trigger).toBeVisible()
  // First line of the trigger is the household name, second is the module.
  return (await trigger.innerText()).split("\n")[0].trim()
}

async function confirmDelete(page: Page) {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(dialog).toBeHidden()
}

async function createHubPerson(page: Page, first: string, last: string) {
  await page.goto("/hub/people")
  await page.getByRole("button", { name: "Add person" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("First name *").fill(first)
  await dialog.getByLabel("Last name *").fill(last)
  await dialog.getByRole("button", { name: "Add person" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText(`${first} ${last}`).first(),
    `hub person "${first} ${last}" should be listed after creation`
  ).toBeVisible()
}

async function deleteHubPerson(page: Page, fullName: string) {
  await page.goto("/hub/people")
  await page.getByText(fullName).first().click()
  await page.waitForURL(/\/hub\/people\/[^/]+$/)
  await page.getByRole("button", { name: "Delete Person" }).click()
  await confirmDelete(page)
  await page.waitForURL(/\/hub\/people\/?$/)
}

test.describe.serial("test family lifecycle", () => {
  test.afterAll(async () => {
    for (const context of contexts) await context.close()
  })

  test("admin provisions the parent and kid accounts", async ({ page }) => {
    await page.goto("/manager/members")
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible()

    for (const user of [
      { first: "E2EParent", last: `Test${ts}`, email: PARENT_EMAIL },
      { first: "E2EKid", last: `Test${ts}`, email: KID_EMAIL },
    ]) {
      await page.getByRole("button", { name: "Add user" }).click()
      const dialog = page.getByRole("dialog")
      await dialog.getByLabel("First name").fill(user.first)
      await dialog.getByLabel("Last name").fill(user.last)
      await dialog.getByLabel("Email").fill(user.email)
      // Role defaults to MEMBER — both family accounts stay non-admin.
      await dialog
        .getByLabel("Password")
        .fill(user.email === PARENT_EMAIL ? PARENT_PASSWORD : KID_PASSWORD)
      await dialog.getByRole("button", { name: "Create user" }).click()
      await expect(dialog).toBeHidden()

      await expect(
        page.getByRole("row").filter({ hasText: user.email }),
        `${user.email} should be listed on the users page`
      ).toBeVisible()
    }

    // Exercise the admin password-reset path too — this is how the owner will
    // hand a known password to a family member next week.
    const kidRow = page.getByRole("row").filter({ hasText: KID_EMAIL })
    await kidRow.getByTitle("Set password").click()
    const pwDialog = page.getByRole("dialog")
    await pwDialog.getByLabel("New password").fill(KID_PASSWORD)
    await pwDialog.getByRole("button", { name: "Set password" }).click()
    await expect(
      pwDialog.getByText("Password updated."),
      "set-password dialog should confirm the reset"
    ).toBeVisible()
    await pwDialog.getByRole("button", { name: "Done" }).click()
    await expect(pwDialog).toBeHidden()
  })

  test("admin creates an isolation marker in its own household", async ({
    page,
  }) => {
    await page.goto("/manager/households")
    adminHouseholdName = await activeHouseholdName(page)
    expect(
      adminHouseholdName,
      "admin must not already be active in the family household"
    ).not.toBe(HOUSEHOLD)

    await createHubPerson(page, MARKER_FIRST, MARKER_LAST)
  })

  test("parent creates the family household and adds the kid", async ({
    browser,
  }) => {
    parentPage = await newSignedInPage(browser, PARENT_EMAIL, PARENT_PASSWORD)

    await parentPage.goto("/manager/households")
    await parentPage.getByRole("button", { name: "New household" }).click()
    const dialog = parentPage.getByRole("dialog")
    await dialog.getByLabel("Name").fill(HOUSEHOLD)
    await dialog.getByRole("button", { name: "Create", exact: true }).click()
    await expect(dialog).toBeHidden()

    // createHouseholdFn makes the creator OWNER and activates the household.
    // The first card mentioning the name is the grid tile (the members card
    // renders after it).
    const card = parentPage
      .locator('[data-slot="card"]')
      .filter({ hasText: HOUSEHOLD })
      .first()
    await expect(
      card.getByText("OWNER"),
      "the parent should be OWNER of the household they created"
    ).toBeVisible()
    await expect(
      card.getByText("Active", { exact: true }),
      "a newly created household should become the active one"
    ).toBeVisible()
    await ensureActiveHousehold(parentPage, HOUSEHOLD)

    await parentPage.getByRole("button", { name: "Add member" }).click()
    const addDialog = parentPage.getByRole("dialog")
    await addDialog.getByLabel("Email").fill(KID_EMAIL)
    await addDialog.getByLabel("Role").selectOption("MEMBER")
    await addDialog.getByRole("button", { name: "Add member" }).click()
    await expect(addDialog).toBeHidden()

    const memberRow = parentPage.getByRole("row").filter({ hasText: KID_EMAIL })
    await expect(
      memberRow,
      "the kid should appear in the household member table"
    ).toBeVisible()
    await expect(
      memberRow.getByText("MEMBER"),
      "the kid should have been added with the MEMBER role"
    ).toBeVisible()
  })

  test("parent creates shared data in hub, finance, and meals", async () => {
    await ensureActiveHousehold(parentPage, HOUSEHOLD)

    await createHubPerson(parentPage, PERSON_FIRST, PERSON_LAST)

    await parentPage.goto("/finance/accounts")
    await parentPage
      .getByRole("button", { name: "Add Account" })
      .first()
      .click()
    const acctDialog = parentPage.getByRole("dialog")
    await acctDialog.getByLabel("Account Name").fill(ACCOUNT)
    await acctDialog.getByLabel("Account Type").selectOption("CHECKING")
    await acctDialog.getByLabel("Starting Balance").fill("250")
    await acctDialog.getByRole("button", { name: "Create Account" }).click()
    await expect(acctDialog).toBeHidden()
    await expect(
      parentPage.getByText(ACCOUNT),
      "the parent should see the account they just created"
    ).toBeVisible()

    await parentPage.goto("/meals/stores")
    await parentPage.getByRole("button", { name: "New store" }).click()
    const storeDialog = parentPage.getByRole("dialog")
    await storeDialog.getByLabel("Name", { exact: true }).fill(STORE)
    await storeDialog.getByRole("button", { name: "Add store" }).click()
    await expect(storeDialog).toBeHidden()
    await expect(
      parentPage.getByRole("row").filter({ hasText: STORE }),
      "the parent should see the store they just created"
    ).toBeVisible()
  })

  test("kid sees the parent's data in every shared module", async ({
    browser,
  }) => {
    kidPage = await newSignedInPage(browser, KID_EMAIL, KID_PASSWORD)
    // The kid belongs to exactly one household, so login activates it; the
    // helper still switches if that ever stops being true.
    await ensureActiveHousehold(kidPage, HOUSEHOLD)

    // The switcher must offer the family household and nothing else — a
    // household the kid does not belong to must never be reachable from it.
    await householdTrigger(kidPage).click()
    await expect(
      kidPage.getByRole("menuitem", { name: HOUSEHOLD, exact: true }),
      "the family household should be listed in the switcher"
    ).toBeVisible()
    await expect(
      kidPage.getByRole("menuitem", { name: adminHouseholdName, exact: true }),
      `the kid must not be offered "${adminHouseholdName}" in the switcher`
    ).toHaveCount(0)
    await kidPage.keyboard.press("Escape")

    await kidPage.goto("/hub/people")
    await expect(
      kidPage.getByText(PERSON).first(),
      "the kid should see the hub person the parent created"
    ).toBeVisible()

    await kidPage.goto("/finance/accounts")
    await expect(
      kidPage.getByText(ACCOUNT),
      "the kid should see the finance account the parent created"
    ).toBeVisible()

    await kidPage.goto("/meals/stores")
    await expect(
      kidPage.getByRole("row").filter({ hasText: STORE }),
      "the kid should see the meals store the parent created"
    ).toBeVisible()
  })

  test("the family cannot see the admin household's data", async () => {
    for (const [label, page] of [
      ["parent", parentPage],
      ["kid", kidPage],
    ] as const) {
      await ensureActiveHousehold(page, HOUSEHOLD)
      await page.goto("/hub/people")
      await expect(
        page.getByText(PERSON).first(),
        `${label} should still see their own household's person`
      ).toBeVisible()
      await expect(
        page.getByText(MARKER),
        `${label} must NOT see "${MARKER}" from ${adminHouseholdName} (ADR-0005)`
      ).toHaveCount(0)
    }
  })

  test("the admin household cannot see the family's data", async ({ page }) => {
    await page.goto("/hub/people")
    expect(
      await activeHouseholdName(page),
      "admin should still be active in its own household"
    ).toBe(adminHouseholdName)
    await expect(
      page.getByText(MARKER).first(),
      "admin should see its own isolation marker"
    ).toBeVisible()
    await expect(
      page.getByText(PERSON),
      `admin must NOT see "${PERSON}" from ${HOUSEHOLD} (ADR-0005)`
    ).toHaveCount(0)
  })

  test("kid does not get the admin-only Users nav item", async () => {
    await kidPage.goto("/manager/households")
    const nav = sidebarNav(kidPage)
    await expect(
      nav.getByRole("link", { name: "Households" }),
      "the kid should still see the non-privileged Manager nav"
    ).toBeVisible()
    await expect(
      nav.getByRole("link", { name: "Users" }),
      "an instance MEMBER must not see the admin-only Users nav item"
    ).toHaveCount(0)

    // Belt and braces: the route itself is gated by adminMiddleware, which
    // redirects a non-admin back to the dashboard.
    await kidPage.goto("/manager/members")
    await expect(
      kidPage.getByRole("heading", { name: "Users" }),
      "a non-admin must not reach the user-management page"
    ).toHaveCount(0)
  })

  test("cleanup: admin removes the marker and both accounts", async ({
    page,
  }) => {
    await deleteHubPerson(page, MARKER)
    await expect(page.getByText(MARKER)).toHaveCount(0)

    await page.goto("/manager/members")
    // Kid FIRST: the parent is the sole OWNER of the family household, and
    // deleteUser refuses to orphan a household that still has other members
    // (the last-owner guard, src/server/users.ts). Once the kid is gone the
    // household has no other members and the parent may be deleted.
    for (const email of [KID_EMAIL, PARENT_EMAIL]) {
      const row = page.getByRole("row").filter({ hasText: email })
      await row.getByTitle("Delete").click()
      await confirmDelete(page)
      await expect(
        page.getByRole("row").filter({ hasText: email }),
        `${email} should be gone after deletion`
      ).toHaveCount(0)
    }

    // The households page offers no delete action, so "E2E Family <ts>" and
    // the data inside it stay behind. Deleting both users cascades away their
    // memberships, which leaves the household with no members — unreachable
    // from every account. Everything is timestamped if it ever needs sweeping.
  })
})
