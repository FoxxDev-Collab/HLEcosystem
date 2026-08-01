import { describe, expect, it } from "vitest"
import { sanitizeFilename } from "./file-validation"

// Regression tests for the CodeQL-driven hardening pass (PR #133): removing
// every path separator makes traversal unrepresentable, and bare directory
// references must never come back as a usable filename.
describe("sanitizeFilename", () => {
  it("keeps ordinary names", () => {
    expect(sanitizeFilename("tax return 2026.pdf")).toBe("tax return 2026.pdf")
  })

  it("strips path separators so traversal cannot be expressed", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("....etcpasswd")
    expect(sanitizeFilename("..\\..\\boot.ini")).toBe("....boot.ini")
    expect(sanitizeFilename("a/b\\c.txt")).toBe("abc.txt")
  })

  it("re-assembled traversal sequences do not survive", () => {
    // A ../-specific replace would turn "..././" into "../" — the separator
    // strip cannot be gamed that way.
    expect(sanitizeFilename("..././..././x")).toBe("........x")
  })

  it("bare directory references become a placeholder", () => {
    expect(sanitizeFilename("..")).toBe("unnamed_file")
    expect(sanitizeFilename(".")).toBe("unnamed_file")
    expect(sanitizeFilename("")).toBe("unnamed_file")
    expect(sanitizeFilename("//")).toBe("unnamed_file")
  })
})
