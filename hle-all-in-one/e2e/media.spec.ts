import { copyFileSync, existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { expect, request, test } from "@playwright/test"

// Full media pipeline: seed a real video into the library, scan from the UI,
// find it in the library grid, and stream it through the range-aware endpoint.
// This is the regression guard for the v1 image that shipped without ffprobe —
// a scan that indexes nothing means the fixture never appears and this fails.
//
// Needs host-side write access to the container's library volume:
//
//   PW_MEDIA_LIBRARY_DIR=$(podman volume inspect \
//     --format '{{.Mountpoint}}' hle-all-in-one_hle-aio-library) bun run e2e
//
// The default named volume is owned by the container's subuid-mapped user, so
// grant the host write access once (dev instance only):
//
//   podman unshare chmod 0777 "$PW_MEDIA_LIBRARY_DIR"
//
// Self-skips when unset (same pattern as setup-wizard.spec.ts). The fixture
// file is left in place after the run: the scanner has no prune pass, so
// deleting it would strand a library row pointing at a missing file. Re-runs
// are idempotent — the scanner upserts on ("householdId", "path").
const LIB_DIR = process.env.PW_MEDIA_LIBRARY_DIR

const MOVIE_TITLE = "E2E Test Movie"
const MOVIE_DIR = path.join("Movies", `${MOVIE_TITLE} (1968)`)
const MOVIE_FILE = `${MOVIE_TITLE} (1968).mp4`
const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "sample.mp4"
)

test.describe("media library", () => {
  test.skip(!LIB_DIR, "PW_MEDIA_LIBRARY_DIR not set")

  test.beforeAll(() => {
    expect(existsSync(FIXTURE), `missing fixture ${FIXTURE}`).toBe(true)
    const dir = path.join(LIB_DIR!, MOVIE_DIR)
    mkdirSync(dir, { recursive: true })
    copyFileSync(FIXTURE, path.join(dir, MOVIE_FILE))
  })

  test("scan indexes the fixture and the stream endpoint serves it", async ({
    page,
  }) => {
    await page.goto("/media")
    await page.getByRole("button", { name: "Scan", exact: true }).click()

    // The scan panel polls every 2.5s and refreshes the grid on completion.
    const card = page.getByRole("link", { name: new RegExp(MOVIE_TITLE) })
    await expect(card).toBeVisible({ timeout: 30_000 })

    await card.click()
    await expect(page).toHaveURL(/\/media\/movies\//)
    await page.getByRole("link", { name: "Play" }).click()
    await expect(page).toHaveURL(/\/media\/play\//)

    const src = await page.locator("video").getAttribute("src")
    expect(src).toMatch(/^\/api\/media\/stream\//)

    // Authenticated range request → 206 with correct partial-content headers.
    const res = await page.request.get(src!, {
      headers: { Range: "bytes=0-1023" },
    })
    expect(res.status()).toBe(206)
    expect(res.headers()["content-range"]).toMatch(/^bytes 0-1023\//)
    expect(res.headers()["content-type"]).toBe("video/mp4")

    // Unauthenticated → 401. newContext() inherits the project's storageState
    // (the admin session), so explicitly blank it out.
    const anon = await request.newContext({
      baseURL: page.url(),
      storageState: { cookies: [], origins: [] },
    })
    const anonRes = await anon.get(new URL(src!, page.url()).toString(), {
      headers: { Range: "bytes=0-1023" },
    })
    expect(anonRes.status()).toBe(401)
    await anon.dispose()
  })
})
