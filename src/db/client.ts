import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.");
}

const globalForDb = globalThis as unknown as {
  postgresClient?: ReturnType<typeof postgres>;
};

export const client = globalForDb.postgresClient ?? postgres(url);

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = client;
}

export const db = drizzle({ client });
