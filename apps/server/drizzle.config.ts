import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/persistence/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      "postgres://howlsinthedark:howlsinthedark@localhost:5432/howlsinthedark",
  },
  strict: true,
  verbose: true,
});
