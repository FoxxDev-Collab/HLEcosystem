// First-run setup token (see docs/adr/0006-first-run-setup-wizard.md in the
// repo root). An uninitialized instance prints this to the container logs;
// the /setup wizard requires it. This closes the fresh-instance takeover
// window: someone who can reach the port before the owner finishes setup
// still cannot claim the instance without log access. SETUP_TOKEN overrides
// for automated provisioning.
import { randomBytes, timingSafeEqual } from "node:crypto"

let generated: string | null = null
let printed = false

export function getSetupToken(): string {
  if (process.env.SETUP_TOKEN) return process.env.SETUP_TOKEN
  if (!generated) generated = randomBytes(8).toString("hex")
  return generated
}

// Called from the setup-status fn while the instance is uninitialized, so
// the token lands in the logs exactly when someone is looking for it.
export function printSetupTokenOnce(): void {
  if (printed) return
  printed = true
  const source = process.env.SETUP_TOKEN ? " (from SETUP_TOKEN env)" : ""
  console.log(
    [
      "",
      "==============================================================",
      "  First-run setup is waiting at /setup",
      `  Setup token${source}: ${getSetupToken()}`,
      "==============================================================",
      "",
    ].join("\n")
  )
}

export function setupTokenMatches(candidate: string): boolean {
  const expected = Buffer.from(getSetupToken())
  const given = Buffer.from(candidate)
  // timingSafeEqual demands equal lengths; a length mismatch is already an
  // observable property, not a secret leak.
  return expected.length === given.length && timingSafeEqual(expected, given)
}

// Test hook.
export function _resetSetupTokenForTests(): void {
  generated = null
  printed = false
}
