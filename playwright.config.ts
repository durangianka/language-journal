import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/support/test-database-url";

const databaseUrl = testDatabaseUrl();
const development = process.env.PLAYWRIGHT_DEV_SERVER === "1";
const port = process.env.PLAYWRIGHT_PORT ?? (development ? "3117" : "3100");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "list",
  globalSetup: "./tests/support/database-setup.ts",
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    env: {
      APP_HOST: "127.0.0.1",
      DATABASE_URL: databaseUrl,
      FEEDBACK_TEST_MODE: "1",
      JEV_TEST_MODE: "1",
      JEV_API_KEY: "",
      OPENAI_API_KEY: "",
    },
    command: development ? `pnpm dev --port ${port}` : `pnpm build && pnpm start --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
