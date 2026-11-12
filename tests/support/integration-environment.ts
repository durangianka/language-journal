import { testDatabaseUrl } from "./test-database-url";

// setupFiles executes inside each worker, before application modules load.
process.env.DATABASE_URL = testDatabaseUrl();
