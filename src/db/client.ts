import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.");
}

declare global {
  var postgresClient: ReturnType<typeof postgres> | undefined;
}

const client = globalThis.postgresClient ?? postgres(url);

if (process.env.NODE_ENV !== "production") {
  globalThis.postgresClient = client;
}

export const db = drizzle({ client });
