import { expect, test } from "vitest";

test("parseEnv reads KEY=VALUE lines and strips quotes", async () => {
  const { parseEnv } = await import("../../scripts/setup-local.mjs");
  expect(parseEnv('# comment\nA=1\nB="two"\nC=\n')).toEqual({ A: "1", B: "two", C: "" });
});

test("blankKeys reports only keys without a value", async () => {
  const { blankKeys } = await import("../../scripts/setup-local.mjs");
  expect(
    blankKeys({ DATABASE_URL: "x", OPENAI_API_KEY: "" }, [
      "DATABASE_URL",
      "OPENAI_API_KEY",
      "JEV_API_KEY",
    ]),
  ).toEqual(["OPENAI_API_KEY", "JEV_API_KEY"]);
});
