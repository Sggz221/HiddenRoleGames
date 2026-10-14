import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import type { HealthResponse } from "@howlsinthedark/shared";
import Fastify, { type FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";

export const APP_VERSION = process.env.npm_package_version ?? "0.0.0";

/** Dependency checks for the readiness probe, e.g. `{ postgres: () => db.ping() }`. */
export type ReadinessChecks = Record<string, () => Promise<boolean>>;

export async function buildApp(
  env: Env,
  readiness: ReadinessChecks = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === "development"
        ? { level: env.LOG_LEVEL, transport: { target: "pino-pretty" } }
        : env.NODE_ENV === "test"
          ? false
          : { level: env.LOG_LEVEL },
    trustProxy: true,
  });

  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        // Socket.IO connects back to the same origin over WebSocket.
        connectSrc: ["'self'", "wss:", "ws:"],
      },
    },
  });

  app.get("/health", async (): Promise<HealthResponse> => {
    return { status: "ok", uptime: process.uptime(), version: APP_VERSION };
  });

  // Liveness stays on /health (Railway healthcheck); readiness reports dependencies.
  app.get("/health/ready", async (_request, reply) => {
    const entries = await Promise.all(
      Object.entries(readiness).map(async ([name, check]) => [name, await check()] as const),
    );
    const checks = Object.fromEntries(entries);
    const ready = entries.every(([, ok]) => ok);
    return reply.code(ready ? 200 : 503).send({ ready, checks });
  });

  if (env.STATIC_DIR) {
    const root = resolve(env.STATIC_DIR);
    if (!existsSync(root)) {
      throw new Error(`STATIC_DIR does not exist: ${root}`);
    }
    await app.register(fastifyStatic, { root, wildcard: false });

    // SPA fallback: client-side routes (e.g. /sala/ABCDE) get index.html.
    app.setNotFoundHandler((request, reply) => {
      if (request.method === "GET" && !request.url.startsWith("/socket.io")) {
        return reply.sendFile("index.html");
      }
      return reply.code(404).send({ error: "Not Found" });
    });
  }

  return app;
}
