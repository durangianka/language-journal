import "dotenv/config";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/support/test-database-url";

testDatabaseUrl();

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    fileParallelism: false,
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["./tests/support/database-setup.ts"],
    setupFiles: ["./tests/support/integration-environment.ts"],
  },
});
