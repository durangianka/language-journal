import "dotenv/config";
import { spawnSync } from "node:child_process";

const development = new URL(process.env.DATABASE_URL);
const test = new URL(process.env.TEST_DATABASE_URL ?? development.href);
if (!process.env.TEST_DATABASE_URL) test.pathname = "/journal_test";
if (
  decodeURIComponent(test.pathname) !== "/journal_test" ||
  test.pathname === development.pathname ||
  test.search ||
  test.hash ||
  test.hostname !== development.hostname ||
  test.port !== development.port
) {
  throw new Error("Only journal_test on the configured Postgres host is permitted.");
}
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Pass a pnpm script name.");
if (![command, ...args].every((arg) => /^[a-zA-Z0-9_./:=-]+$/.test(arg)))
  throw new Error("Only plain script names and arguments are accepted.");
const env = { ...process.env, TEST_DATABASE_URL: test.href };
if (["db:migrate", "build", "dev"].includes(command)) env.DATABASE_URL = test.href;
const result = spawnSync("pnpm", [command, ...args], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
