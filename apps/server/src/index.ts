import { loadEnv } from "./config/env.js";
import { buildApp } from "./http/app.js";

const SHUTDOWN_TIMEOUT_MS = 15_000;

const env = loadEnv();
const app = await buildApp(env);

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, "shutting down");

  // Hard exit if connections refuse to close in time.
  const timer = setTimeout(() => {
    app.log.error("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    process.exit(1);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error, "failed to start server");
  process.exit(1);
}
