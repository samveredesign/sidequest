import { defineConfig } from "@playwright/test";

const databaseUrl = "postgresql://sidequest:sidequest@localhost:5432/sidequest";

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
    headless: true,
  },
  webServer: {
    command: "npx next dev --webpack --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  },
});
