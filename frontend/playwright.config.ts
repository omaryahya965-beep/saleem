import { defineConfig, devices } from "@playwright/test";

// E2E against the production build (vite preview). Public data comes from the configured
// Supabase project; signed-in flows use network mocks (scripts/mock-auth.mjs).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: process.env["CI"] ? 2 : 3,
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"] ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  projects: [
    {
      name: "ar-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      metadata: { lang: "ar" },
    },
    {
      name: "en-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      metadata: { lang: "en" },
    },
    {
      name: "ar-mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } },
      metadata: { lang: "ar" },
    },
  ],
  webServer: {
    command: "npx vite build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
