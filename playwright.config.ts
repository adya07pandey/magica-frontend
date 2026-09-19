import { defineConfig, devices } from "playwright/test";

const E2E_HOST = process.env.E2E_HOST ?? "127.0.0.1";
const E2E_PORT = process.env.E2E_PORT ?? "3011";
const E2E_BASE_URL =
  process.env.E2E_BASE_URL ?? `http://${E2E_HOST}:${E2E_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `pnpm start --hostname ${E2E_HOST} --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
