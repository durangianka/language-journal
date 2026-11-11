/** Validate before opening any connection or replacing DATABASE_URL. */
export function testDatabaseUrl(env: Record<string, string | undefined> = process.env): string {
  function parse(value: string | undefined, name: string) {
    if (!value) throw new Error(`${name} is required. See .env.example.`);
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`${name} must be a valid Postgres URL.`);
    }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname) {
      throw new Error(`${name} must be a valid Postgres URL.`);
    }
    // Postgres.js accepts query parameters as connection options. Disallow
    // overrides that could redirect a URL after it has passed this guard.
    if (url.search || url.hash)
      throw new Error(`${name} must not contain query parameters or a fragment.`);
    let database: string;
    try {
      database = decodeURIComponent(url.pathname.slice(1));
    } catch {
      throw new Error(`${name} has an invalid database name.`);
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(database)) {
      throw new Error(`${name} must name a database explicitly.`);
    }
    return { url, database };
  }

  const development = parse(env.DATABASE_URL, "DATABASE_URL");
  const test = parse(env.TEST_DATABASE_URL, "TEST_DATABASE_URL");
  // Compare names even across host aliases or different credentials.
  if (development.database === test.database) {
    throw new Error("DATABASE_URL and TEST_DATABASE_URL must not point at the same database.");
  }
  if (!test.database.endsWith("_test")) {
    throw new Error("TEST_DATABASE_URL database name must end in _test.");
  }
  const host = (url: URL) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ? "loopback" : url.hostname;
  if (
    host(development.url) !== host(test.url) ||
    (development.url.port || "5432") !== (test.url.port || "5432")
  ) {
    throw new Error("TEST_DATABASE_URL must use the same Postgres host and port as DATABASE_URL.");
  }
  return test.url.href;
}
