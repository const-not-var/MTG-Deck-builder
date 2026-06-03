import { defineConfig, devices } from "@playwright/test"

// Runs against a dedicated server on its own port with an ISOLATED test database,
// so E2E never touches real data.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const BASE = `http://localhost:${PORT}`
const TEST_DB = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/commandervault_e2e"

export default defineConfig({
  testDir: "./e2e",
  workers: 1,            // shared DB → keep runs deterministic
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: { baseURL: BASE, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      testIgnore: /mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    // Production build/start into an isolated dir so the suite runs alongside a
    // running `next dev` (Next 16 forbids two dev servers per dir; start is fine).
    command: `npx next build && npx next start -p ${PORT}`,
    url: BASE,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      MONGODB_URI: TEST_DB,
      MONGODB_DB: "commandervault_e2e",   // connectDB() honors this; keeps tests off the real DB
      NEXTAUTH_URL: BASE,
      AUTH_URL: BASE,
      AUTH_TRUST_HOST: "true",
      E2E_TEST: "1",      // disables IP rate-limiting so the suite can create many accounts
      E2E_DISTDIR: ".next-e2e",
    },
  },
})
