import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function nextArguments(mode, args, env) {
  if (!["dev", "start"].includes(mode)) throw new Error("Expected dev or start.");
  if (args.some((arg) => arg === "-H" || arg.startsWith("-H") || arg.startsWith("--hostname")))
    throw new Error("Set APP_HOST to choose the listening address.");
  return [mode, "--hostname", env.APP_HOST || "127.0.0.1", ...args];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const require = createRequire(import.meta.url);
  const [mode, ...args] = process.argv.slice(2);
  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), ...nextArguments(mode, args, process.env)],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  child.on("error", () => {
    console.error("next_launch_failed");
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
