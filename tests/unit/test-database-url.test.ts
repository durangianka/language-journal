import { expect, test } from "vitest";
import { testDatabaseUrl } from "../support/test-database-url";

const development = "postgres://journal:journal@localhost:5433/journal";
const testing = "postgres://journal:journal@localhost:5433/journal_test";

test("accepts a separate test database on the development server", () => {
  expect(testDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: testing })).toBe(testing);
});

test.each([
  {},
  { DATABASE_URL: development },
  { TEST_DATABASE_URL: testing },
  { DATABASE_URL: "bad", TEST_DATABASE_URL: testing },
  { DATABASE_URL: development, TEST_DATABASE_URL: "bad" },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing.replace("postgres:", "https:") },
  { DATABASE_URL: development, TEST_DATABASE_URL: development },
  {
    DATABASE_URL: testing,
    TEST_DATABASE_URL: testing
      .replace("localhost", "127.0.0.1")
      .replace("journal:journal", "other:password"),
  },
  { DATABASE_URL: testing, TEST_DATABASE_URL: testing.replace("journal_test", "journal%5ftest") },
  {
    DATABASE_URL: development,
    TEST_DATABASE_URL: testing.replace("journal_test", "journal_testing"),
  },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing.replace("5433", "5434") },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing.replace("localhost", "example.com") },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing + "?database=journal" },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing + "?host=example.com" },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing + "#fragment" },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing.replace("/journal_test", "/") },
  { DATABASE_URL: development, TEST_DATABASE_URL: testing.replace("journal_test", "%xx_test") },
])("rejects missing or unsafe database configuration %# before connecting", (env) => {
  expect(() => testDatabaseUrl(env)).toThrow();
});

test("unit tests reject a real database client and unmocked network access", async () => {
  const { default: postgres } = await import("postgres");
  expect(() => postgres(testing)).toThrow("Unit tests must mock the database");
  expect(() => fetch("http://localhost:5433")).toThrow("Unit tests must mock fetch");
  const { Socket } = await import("node:net");
  expect(() => new Socket().connect(5433)).toThrow("Unit tests must mock network");
});
