import { readFileSync } from "node:fs";
import { expect, test, vi } from "vitest";

vi.mock("node:child_process", () => ({ spawn: vi.fn(() => ({ on: vi.fn() })) }));

test.each(["dev", "start"])("%s uses the APP_HOST launcher", (mode) => {
  const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
  expect(scripts[mode]).toBe(`node scripts/next-host.mjs ${mode}`);
});

test.each(["dev", "start"])(
  "%s binds only to Tailscale by default and supports APP_HOST",
  async (mode) => {
    const { nextArguments } = await import("../../scripts/next-host.mjs");
    expect(nextArguments(mode, [], {})).toEqual([mode, "--hostname", "100.66.182.87"]);
    expect(nextArguments(mode, ["--port", "3117"], { APP_HOST: "127.0.0.1" })).toEqual([
      mode,
      "--hostname",
      "127.0.0.1",
      "--port",
      "3117",
    ]);
    expect(() => nextArguments(mode, ["--hostname", "0.0.0.0"], {})).toThrow("APP_HOST");
  },
);
