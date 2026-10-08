import { defineConfig } from "@playwright/test";
import "dotenv/config";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL: process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173",
    channel: "chrome",
    headless: true,
    viewport: { width: 1366, height: 768 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  projects: [{ name: "desktop" }],
});
