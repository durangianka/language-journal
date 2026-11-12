import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { testDatabaseUrl } from "./tests/support/test-database-url";

const databaseUrl = testDatabaseUrl();
const development = process.env.PLAYWRIGHT_DEV_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: "list",
  globalSetup: "./tests/support/database-setup.ts",
  workers: 1,
  use: {
    baseURL: development ? "http://127.0.0.1:3117" : "http://127.0.0.1:3100",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    env: {
      DATABASE_URL: databaseUrl,
      FEEDBACK_TEST_MODE: "1",
      JEV_TEST_MODE: "1",
      JEV_API_KEY: "",
      OPENAI_API_KEY: "",
    },
    command: development
      ? "pnpm dev --hostname 127.0.0.1 --port 3117"
      : "pnpm build && pnpm start --hostname 127.0.0.1 --port 3100",
    url: development ? "http://127.0.0.1:3117" : "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
