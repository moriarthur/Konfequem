import { defineConfig } from "@playwright/test";

/**
 * Scripted product-demo recorder — separate from the CI-style E2E on
 * purpose: slowMo and scene pauses make a watchable video but a terrible
 * regression test. Run via `npm run demo` (scripts/record-demo.sh).
 *
 * Produces a WebM recording per run (converted to GIF/MP4 by the shell
 * script afterwards).
 */
export default defineConfig({
  testDir: "./e2e/demo",
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [["line"]],
  outputDir: "./demo-output/raw",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    video: { mode: "on", size: { width: 1440, height: 900 } },
    launchOptions: { slowMo: 200 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
