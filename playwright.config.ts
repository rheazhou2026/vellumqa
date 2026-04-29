import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright e2e config for Vellum.
 *
 * The auth e2e suite hits a deployed preview URL because account creation flows
 * through Lovable Cloud. By default it runs against the published Vellum URL,
 * but you can override with VELLUM_E2E_URL=https://id-preview--<id>.lovable.app
 * or http://localhost:8080 if you have the dev server running.
 */
const baseURL = process.env.VELLUM_E2E_URL ?? "https://vellumqa.lovable.app";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : [["list"]],
  use: {
    baseURL,
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});