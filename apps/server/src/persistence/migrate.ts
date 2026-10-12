// Applies pending SQL migrations. Runs as Railway's pre-deploy command and via `pnpm db:migrate`.
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { connectDatabase } from "./db.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.warn("migrate: DATABASE_URL not set, nothing to do");
  process.exit(0);
}

const migrationsFolder = fileURLToPath(new URL("../../drizzle", import.meta.url));
const connection = connectDatabase(url);

try {
  await migrate(connection.db, { migrationsFolder });
  console.warn("migrate: database is up to date");
} finally {
  await connection.close();
}
