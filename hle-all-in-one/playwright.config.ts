import process from "node:process"
import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PW_BASE_URL ?? "http://localhost:8100"

export default defineConfig({
  testDir: "./e2e",
  // The suite runs against the shared dev database — never in parallel.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    // First-run wizard: no auth dependency (an empty database has nobody to
    // log in as). Self-skips unless the instance is uninitialized AND
    // SETUP_TOKEN is provided — see e2e/setup-wizard.spec.ts.
    {
      name: "setup-wizard",
      testMatch: /setup-wizard\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testIgnore: /setup-wizard\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/state.json",
      },
      dependencies: ["setup"],
    },
  ],
})
