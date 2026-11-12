import "dotenv/config";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/support/test-database-url";

testDatabaseUrl();

export default defineConfig({
  test: {
    fileParallelism: false,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/support/database-setup.ts"],
    setupFiles: ["./tests/support/integration-environment.ts"],
  },
});
