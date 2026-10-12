import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

export function connectDatabase(url: string): DatabaseConnection {
  const client = postgres(url, { max: 5, idle_timeout: 30, connect_timeout: 10 });
  return {
    db: drizzle(client, { schema }),
    async ping() {
      try {
        await client`select 1`;
        return true;
      } catch {
        return false;
      }
    },
    close: () => client.end({ timeout: 5 }),
  };
}
