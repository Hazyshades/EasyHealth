import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error("E2E_BASE_URL is required. Point it at the already-running local EasyHealth server.");
}

export default defineConfig({
  testDir: "./e2e/specs",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 45_000,
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    storageState: ".playwright/e2e-primary-storage-state.json",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Keep navigational evidence while excluding DOM/source snapshots that can
    // contain public runtime configuration from the Next.js bundle.
    trace: {
      mode: "retain-on-failure",
      screenshots: true,
      snapshots: false,
      sources: false,
    },
  },
  outputDir: "test-results",
});
