import { describe, expect, it } from "vitest"
import { pgTextArray } from "./pg-text-array"

// pgTextArray builds the Postgres array-literal syntax by hand (see db.ts for
// why no other binding works under Bun 1.3.x). The escaping rules here were
// verified by round-tripping through a live PG18 TEXT[] column: every case
// below inserted and read back byte-identical.
describe("pgTextArray", () => {
  it("empty array → empty literal (the DEFAULT '{}' case)", () => {
    expect(pgTextArray([])).toBe("{}")
  })

  it("plain elements", () => {
    expect(pgTextArray(["a", "b"])).toBe('{"a","b"}')
  })

  it("quotes every element, so commas and braces stay literal", () => {
    expect(pgTextArray(["a,b", "{brace}"])).toBe('{"a,b","{brace}"}')
  })

  it("escapes double quotes and backslashes", () => {
    expect(pgTextArray(['say "hi"', "back\\slash"])).toBe(
      '{"say \\"hi\\"","back\\\\slash"}'
    )
  })

  it("preserves empty strings and whitespace", () => {
    expect(pgTextArray(["", "  padded  "])).toBe('{"","  padded  "}')
  })
})
