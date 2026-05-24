import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 8_000,
  },
  use: {
    baseURL: "http://127.0.0.1:5001",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "NEXT_PUBLIC_LYCIUM_BASE_PATH=/Lycium corepack pnpm dev",
    url: "http://127.0.0.1:5001/Lycium/catalog",
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
