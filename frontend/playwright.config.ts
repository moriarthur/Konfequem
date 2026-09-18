import { defineConfig } from "@playwright/test";

/**
 * Browser E2E for the main booking happy path.
 *
 * Requires the full stack to be running first:
 *   docker compose up -d
 *
 * Not wired into CI yet — run locally:
 *   npm run e2e
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  // One flow, one browser — the test registers its own org with a unique
  // slug, so parallel runs would only multiply leftover test orgs.
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
