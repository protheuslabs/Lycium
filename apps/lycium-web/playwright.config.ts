import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  workers: 1,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: "http://localhost:5001",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium corepack pnpm dev",
    url: "http://localhost:5001/Lycium/catalog",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
