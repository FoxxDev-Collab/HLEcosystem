// Single source of truth for the password policy. Imported by the client
// (live validation checklist) AND the server (zod refinement) so the rules can
// never drift apart. Pure functions only — safe on both sides.

export type PasswordRule = { label: string; test: (pw: string) => boolean }

export const PASSWORD_RULES: Array<PasswordRule> = [
  { label: "At least 12 characters", test: (pw) => pw.length >= 12 },
  { label: "An uppercase letter (A–Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "A lowercase letter (a–z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "A number (0–9)", test: (pw) => /[0-9]/.test(pw) },
  {
    label: "A special character (!@#$…)",
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
]

export function passwordIsValid(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw))
}

export function passwordFailures(pw: string): Array<string> {
  return PASSWORD_RULES.filter((rule) => !rule.test(pw)).map(
    (rule) => rule.label
  )
}
