import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["./tests/support/unit-environment.ts"],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
