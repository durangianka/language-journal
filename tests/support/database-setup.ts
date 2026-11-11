import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { testDatabaseUrl } from "./test-database-url";

export default async function setup() {
  const url = testDatabaseUrl();
  const database = decodeURIComponent(new URL(url).pathname.slice(1));
  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.href, { max: 1 });
  try {
    const existing = await admin`select 1 from pg_database where datname = ${database}`;
    if (!existing.length) await admin`create database ${admin(database)}`;
  } finally {
    await admin.end();
  }

  async function empty() {
    const client = postgres(url, { max: 1 });
    try {
      const tables = await client<{ schemaname: string; tablename: string }[]>`
        select schemaname, tablename from pg_tables where schemaname = 'public'
      `;
      if (tables.length) {
        await client`truncate table ${client(tables.map(({ schemaname, tablename }) => `${schemaname}.${tablename}`))} restart identity cascade`;
      }
    } finally {
      await client.end();
    }
  }

  const client = postgres(url, { max: 1 });
  try {
    // Recover if a browser failure test was interrupted before its finally block.
    await client`drop function if exists public.test_reject_insert() cascade`;
    await migrate(drizzle({ client }), { migrationsFolder: "./drizzle" });
    await empty();
  } finally {
    await client.end();
  }
  return empty;
}
