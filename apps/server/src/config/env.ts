import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PUBLIC_URL: z.url().optional(),
  /** Directory with the compiled web client. Unset in dev (Vite serves it). */
  STATIC_DIR: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  /** PostgreSQL (game history, later accounts). Without it, history is not persisted. */
  DATABASE_URL: z.url().optional(),
  /** Redis (live game snapshots + Socket.IO adapter). Without it, state lives in memory only. */
  REDIS_URL: z.url().optional(),
  /** How long a live game snapshot survives in Redis without activity. */
  GAME_SNAPSHOT_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(6 * 60 * 60),
  /** How long a lobby seat is held after its player disconnects (games keep the seat). */
  RECONNECT_GRACE_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates process env. Throws on invalid configuration so the process fails fast. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
