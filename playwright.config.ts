import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/support/test-database-url";

const databaseUrl = testDatabaseUrl();

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "list",
  globalSetup: "./tests/support/database-setup.ts",
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    env: { DATABASE_URL: databaseUrl, FEEDBACK_TEST_MODE: "1", OPENAI_API_KEY: "" },
    command: "pnpm build && pnpm start --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
