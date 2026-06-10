import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

// One create → verify → delete flow per module, against the real (shared dev)
// database. Every entity uses a unique "E2E Smoke" name and is deleted by the
// same test, so any leftovers are identifiable.
const stamp = Date.now()

async function confirmDelete(page: Page) {
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await dialog.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(dialog).toBeHidden()
}

test("manager: households page lists the existing household", async ({
  page,
}) => {
  await page.goto("/manager/households")
  await expect(page.getByRole("heading", { name: "Households" })).toBeVisible()
  // The session always has an active household — its card shows "Active".
  await expect(page.getByText("Active", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("OWNER").first()).toBeVisible()
})

test("hub: create, see, and delete a family member", async ({ page }) => {
  const first = "E2ESmoke"
  const last = `Person${stamp}`
  const fullName = `${first} ${last}`

  await page.goto("/hub/people")
  await page.getByRole("button", { name: "Add person" }).click()

  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("First name *").fill(first)
  await dialog.getByLabel("Last name *").fill(last)
  await dialog.getByRole("button", { name: "Add person" }).click()
  await expect(dialog).toBeHidden()

  // Listed under "Other Contacts" — open the detail page.
  await page.getByText(fullName).click()
  await page.waitForURL(/\/hub\/people\/[^/]+$/)
  await page.getByRole("button", { name: "Delete Person" }).click()
  await confirmDelete(page)

  await page.waitForURL(/\/hub\/people\/?$/)
  await expect(page.getByText(fullName)).toHaveCount(0)
})

test("health: create and delete a provider", async ({ page }) => {
  const name = `E2E Smoke Provider ${stamp}`

  await page.goto("/health/providers")
  await page.getByLabel("Name", { exact: true }).fill(name)
  await page.getByRole("button", { name: "Add Provider" }).click()

  const row = page.locator("div.py-3").filter({ hasText: name })
  await expect(row).toBeVisible()
  await row.getByTitle("Delete").click()
  await confirmDelete(page)

  await expect(page.getByText(name)).toHaveCount(0)
})

test("finance: create a checking account, see it, delete it", async ({
  page,
}) => {
  const name = `E2E Smoke Account ${stamp}`

  await page.goto("/finance/accounts")
  await page.getByRole("button", { name: "Add Account" }).first().click()

  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Account Name").fill(name)
  await dialog.getByLabel("Account Type").selectOption("CHECKING")
  await dialog.getByLabel("Starting Balance").fill("100")
  await dialog.getByRole("button", { name: "Create Account" }).click()
  await expect(dialog).toBeHidden()

  // Listed on the index — delete lives on the account detail page.
  await page.getByText(name).click()
  await page.waitForURL(/\/finance\/accounts\/[^/]+$/)
  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await confirmDelete(page)

  await page.waitForURL(/\/finance\/accounts\/?$/)
  await expect(page.getByText(name)).toHaveCount(0)
})

test("home-care: create and delete a room", async ({ page }) => {
  const name = `E2E Smoke Room ${stamp}`

  await page.goto("/home-care/rooms")
  await page.getByLabel("Name", { exact: true }).fill(name)
  await page.getByRole("button", { name: "Add Room" }).click()

  // Rows render the room name inside an editable input, so match on value.
  const roomInputs = page.locator('tbody input[aria-label="Room name"]')
  const values = () =>
    roomInputs.evaluateAll((els) =>
      els.map((el) => (el as HTMLInputElement).value)
    )
  await expect.poll(values).toContain(name)
  const idx = (await values()).indexOf(name)
  await page.locator("tbody tr").nth(idx).getByTitle("Delete room").click()
  await confirmDelete(page)

  await expect.poll(values).not.toContain(name)
})

test("meals: create and delete a store", async ({ page }) => {
  const name = `E2E Smoke Store ${stamp}`

  await page.goto("/meals/stores")
  await page.getByRole("button", { name: "New store" }).click()

  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Name", { exact: true }).fill(name)
  await dialog.getByRole("button", { name: "Add store" }).click()
  await expect(dialog).toBeHidden()

  const row = page.getByRole("row").filter({ hasText: name })
  await expect(row).toBeVisible()
  await row.getByTitle("Delete").click()
  await confirmDelete(page)

  await expect(page.getByText(name)).toHaveCount(0)
})

test("travel: create, open, and delete a trip", async ({ page }) => {
  const name = `E2E Smoke Trip ${stamp}`

  await page.goto("/travel/trips")
  await page.getByRole("button", { name: "Create trip" }).click()

  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Trip name *").fill(name)
  await dialog.getByLabel("Start date *").fill("2026-07-01")
  await dialog.getByLabel("End date *").fill("2026-07-08")
  await dialog.getByRole("button", { name: "Create trip" }).click()
  await expect(dialog).toBeHidden()

  await page.getByText(name).click()
  await page.waitForURL(/\/travel\/trips\/[^/]+/)
  await page.getByRole("button", { name: "Delete trip" }).click()
  await confirmDelete(page)

  await page.waitForURL(/\/travel\/trips\/?$/)
  await expect(page.getByText(name)).toHaveCount(0)
})

test("wiki: create a page, see it, delete it", async ({ page }) => {
  const title = `E2E Smoke Page ${stamp}`

  await page.goto("/wiki/pages")
  await page.getByLabel("New Page").fill(title)
  await page.getByRole("button", { name: "Create", exact: true }).click()

  // Create lands in the editor; the delete action lives on the page view.
  await page.waitForURL(/\/wiki\/pages\/[^/]+\/edit/)
  const match = /\/wiki\/pages\/([^/]+)\/edit/.exec(page.url())
  expect(match).not.toBeNull()
  const id = match?.[1] ?? ""

  await page.goto(`/wiki/pages/${id}`)
  await expect(page.getByText(title).first()).toBeVisible()
  await page.getByTitle("Delete page").click()
  await confirmDelete(page)

  await page.waitForURL(/\/wiki\/pages\/?$/)
  await expect(page.getByText(title)).toHaveCount(0)
})
