import { loadEnv } from "./config/env.js";
import { GameRegistry } from "./game/registry.js";
import { type GameStore, MemoryGameStore, RedisGameStore } from "./game/store.js";
import { buildApp, type ReadinessChecks } from "./http/app.js";
import { connectDatabase } from "./persistence/db.js";
import {
  type GameHistory,
  NoopGameHistory,
  PostgresGameHistory,
} from "./persistence/game-history.js";
import { createRealtime, socketPublisher } from "./realtime/io.js";
import { connectRedis, pingRedis } from "./realtime/redis.js";
import { RoomManager } from "./rooms/manager.js";

const SHUTDOWN_TIMEOUT_MS = 15_000;
const ROOM_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const env = loadEnv();
const readiness: ReadinessChecks = {};

const database = env.DATABASE_URL ? connectDatabase(env.DATABASE_URL) : null;
if (database) readiness.postgres = () => database.ping();

const app = await buildApp(env, readiness);
const log = app.log;

const redis = env.REDIS_URL ? connectRedis(env.REDIS_URL, log, "main") : undefined;
if (redis) {
  const client = redis;
  readiness.redis = () => pingRedis(client);
}

if (env.NODE_ENV === "production" && (!database || !redis)) {
  log.warn(
    { postgres: Boolean(database), redis: Boolean(redis) },
    "running without Postgres and/or Redis: history or live-game recovery disabled",
  );
}

const store: GameStore = redis
  ? new RedisGameStore(redis, env.GAME_SNAPSHOT_TTL_SECONDS)
  : new MemoryGameStore();
const history: GameHistory = database
  ? new PostgresGameHistory(database.db)
  : new NoopGameHistory();

// The publisher needs `io`, and `io` needs the registry: wire through a late-bound reference.
let publish: ReturnType<typeof socketPublisher> | undefined;
const registry = new GameRegistry({
  store,
  history,
  log,
  publisher: {
    sendEvents: (...args) => publish?.sendEvents(...args),
    sendView: (...args) => publish?.sendView(...args),
  },
});

const rooms = new RoomManager();
const roomSweeper = setInterval(() => {
  const removed = rooms.sweep();
  if (removed.length) log.info({ removed: removed.length }, "removed idle rooms");
}, ROOM_SWEEP_INTERVAL_MS);
roomSweeper.unref();

const realtime = createRealtime(app.server, { registry, rooms, log, ...(redis ? { redis } : {}) });
publish = socketPublisher(realtime.io);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal }, "shutting down");

  const timer = setTimeout(() => {
    log.error("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    // Snapshots stay in Redis, so the next instance resumes running games.
    clearInterval(roomSweeper);
    await registry.disposeAll();
    await realtime.close();
    await app.close();
    await redis?.quit();
    await database?.close();
    process.exit(0);
  } catch (error) {
    log.error(error, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  const restored = await registry.restoreAll();
  if (restored) log.info({ restored }, "resumed live games");
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  log.error(error, "failed to start server");
  process.exit(1);
}
