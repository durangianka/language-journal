import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REQUIRED_KEYS = ["DATABASE_URL"];
const OPTIONAL_KEYS = ["OPENAI_API_KEY", "JEV_API_KEY"];

export function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return env;
}

export function blankKeys(env, keys) {
  return keys.filter((key) => !env[key]);
}

function fail(message) {
  console.error(`\nSetup stopped: ${message}`);
  process.exit(1);
}

function step(title, command, args, shell = false) {
  console.log(`\n==> ${title}`);
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell });
  if (result.status !== 0) fail(`"${title}" failed.`);
}

function main(argv) {
  const withoutDocker = argv.includes("--no-docker");
  const envPath = resolve(root, ".env");

  if (existsSync(envPath)) {
    console.log(".env already exists and was left unchanged.");
  } else {
    copyFileSync(resolve(root, ".env.example"), envPath);
    console.log("Created .env from .env.example.");
  }

  const env = parseEnv(readFileSync(envPath, "utf8"));
  const missing = blankKeys(env, REQUIRED_KEYS);
  if (missing.length) fail(`set ${missing.join(", ")} in .env, then run setup again.`);

  if (!withoutDocker) {
    const docker = spawnSync("docker", ["info"], { stdio: "ignore" });
    if (docker.status !== 0)
      fail(
        "Docker is not running. Start Docker Desktop and try again, or run pnpm setup:no-docker with your own Postgres 17 at DATABASE_URL.",
      );
    step("Starting the database", "docker", ["compose", "up", "-d", "--wait", "db"]);
  }

  step("Installing dependencies", "pnpm install --frozen-lockfile", [], true);
  step("Running database migrations", "pnpm db:migrate", [], true);

  const optional = blankKeys(env, OPTIONAL_KEYS);
  if (optional.length) {
    console.log(
      `\nNote: ${optional.join(", ")} blank in .env. Feedback and Jev stay unavailable until you set them. Writing still saves.`,
    );
  }
  console.log(
    "\nSetup complete. Start the app with:\n\n  pnpm dev\n\nThen open http://127.0.0.1:3000",
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
