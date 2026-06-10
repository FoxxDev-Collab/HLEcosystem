import { expect, test } from "@playwright/test"
import { MODULES } from "../src/lib/modules"

// Every nav href across all enabled modules — the single source of truth the
// sidebar renders from. A new nav item is automatically swept.
const hrefs = [
  ...new Set(
    MODULES.filter((m) => m.enabled).flatMap((m) =>
      m.nav.flatMap((g) => g.items.map((i) => i.href))
    )
  ),
]

// Rendered by the TanStack Router default error boundary.
const ERROR_BOUNDARY_TEXT = "Something went wrong!"
// Rendered by <ModulePlaceholder/> — a leftover stub must fail the sweep.
const PLACEHOLDER_TEXT = "Placeholder — real page ported in a later phase."

test.describe("page sweep", () => {
  for (const href of hrefs) {
    test(`renders ${href}`, async ({ page }) => {
      const response = await page.goto(href)
      expect(response, `no response for ${href}`).not.toBeNull()
      expect(
        response?.ok(),
        `HTTP ${response?.status()} for ${href}`
      ).toBeTruthy()

      const h1 = page.locator("h1").first()
      await expect(h1).toBeVisible()
      await expect(h1).not.toHaveText("404")

      await expect(page.getByText(ERROR_BOUNDARY_TEXT)).toHaveCount(0)
      await expect(page.getByText(PLACEHOLDER_TEXT)).toHaveCount(0)
    })
  }
})
