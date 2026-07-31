import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Guards a Bun.sql serialization hazard that produced a hard 500 on /media.
//
// Bun 1.3.x binds a JS array parameter as a comma-joined string, NOT as a
// Postgres array literal. So this:
//
//     sql`... WHERE "contentRating" = ANY(${["G", "PG"]})`
//
// sends the text "G,PG" and Postgres answers `malformed array literal`. An
// explicit `::text[]` / `::uuid[]` cast does not help — the value is already
// wrong by the time the cast runs, so the bug looks fixed but isn't.
//
// The construct that works is Bun's list helper, which expands to one bound
// placeholder per element and stays fully parameterized:
//
//     sql`... WHERE "contentRating" IN ${sql(ratings)}`
//
// Caveat carried by every call site: `sql([])` expands to `()`, a syntax
// error. Callers must return early on an empty array.

const SERVER_DIR = path.resolve(import.meta.dirname)

async function serverSourceFiles(dir: string): Promise<Array<string>> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return serverSourceFiles(full)
      if (!entry.name.endsWith(".ts")) return []
      if (entry.name.endsWith(".test.ts")) return []
      return [full]
    })
  )
  return files.flat()
}

// `ANY(${expr})` — a template substitution passed straight to ANY(), with or
// without a trailing array cast.
const ANY_TEMPLATE_PARAM = /ANY\(\s*\$\{/
// `${expr}::text[]` (any array cast) where expr is not pgTextArray(...) — a
// bare array param 500s (`malformed array literal`) and `sql.array()` silently
// corrupts elements with literal quotes. pgTextArray in db.ts is the one
// binding that round-trips; a `'{}'::text[]` SQL literal (no `${`) is fine.
const ARRAY_CAST_PARAM = /\$\{(?!pgTextArray\()[^}]*\}::\w+\[\]/

async function offendersMatching(re: RegExp): Promise<Array<string>> {
  const files = await serverSourceFiles(SERVER_DIR)
  expect(files.length).toBeGreaterThan(0)
  const hits = await Promise.all(
    files.map(async (file) => {
      const lines = (await readFile(file, "utf8")).split("\n")
      return lines.flatMap((line, i) =>
        re.test(line)
          ? [`${path.relative(SERVER_DIR, file)}:${i + 1}: ${line.trim()}`]
          : []
      )
    })
  )
  return hits.flat()
}

describe("Bun.sql array parameters", () => {
  it("no server query passes a template parameter to ANY()", async () => {
    expect(
      await offendersMatching(ANY_TEMPLATE_PARAM),
      "Use `IN ${sql(arr)}` instead — see the comment at the top of this file"
    ).toEqual([])
  })

  it("array-column values only bind through pgTextArray()", async () => {
    expect(
      await offendersMatching(ARRAY_CAST_PARAM),
      "Bind array columns as ${pgTextArray(arr)}::text[] — see db.ts"
    ).toEqual([])
  })
})
