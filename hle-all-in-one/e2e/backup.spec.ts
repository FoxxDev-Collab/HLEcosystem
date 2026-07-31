import { expect, test } from "@playwright/test"

// The admin backup endpoints stream the whole instance — database dump and
// uploads archive. Assert real content (format magic bytes), not just a 200,
// and that authentication is enforced.
test.describe("instance backup", () => {
  test("database dump downloads as a valid pg_dump custom-format file", async ({
    request,
  }) => {
    const res = await request.get("/api/admin/backup-db")
    expect(res.status(), "admin session should be allowed").toBe(200)
    expect(res.headers()["content-disposition"]).toContain(".dump")
    const body = await res.body()
    expect(body.length, "dump should not be empty").toBeGreaterThan(1000)
    // pg_dump custom format opens with the "PGDMP" signature.
    expect(
      body.subarray(0, 5).toString("latin1"),
      "custom-format dump must start with PGDMP"
    ).toBe("PGDMP")
  })

  test("uploads archive downloads as gzip", async ({ request }) => {
    const res = await request.get("/api/admin/backup-uploads")
    expect(res.status()).toBe(200)
    expect(res.headers()["content-disposition"]).toContain(".tar.gz")
    const body = await res.body()
    // gzip magic bytes 0x1f 0x8b; an empty uploads dir still yields a valid
    // (small) archive.
    expect(body[0], "gzip magic byte 1").toBe(0x1f)
    expect(body[1], "gzip magic byte 2").toBe(0x8b)
  })

  test("both endpoints reject unauthenticated requests", async ({
    playwright,
  }) => {
    // A request context WITHOUT the admin session. newContext() INHERITS the
    // project's storageState (verified: omitting this sent the admin cookie
    // and got a 200), so an explicitly empty state is required.
    const anon = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
      storageState: { cookies: [], origins: [] },
    })
    for (const path of ["/api/admin/backup-db", "/api/admin/backup-uploads"]) {
      const res = await anon.get(path)
      expect(res.status(), `${path} must require a session`).toBe(401)
    }
    await anon.dispose()
  })
})
