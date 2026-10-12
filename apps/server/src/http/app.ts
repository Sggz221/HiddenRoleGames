import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { HealthResponse } from "@aullidos/shared";
import fastifyHelmet from "@fastify/helmet";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyInstance } from "fastify";
import type { Env } from "../config/env.js";

export const APP_VERSION = process.env.npm_package_version ?? "0.0.0";

export async function buildApp(env: Env): Promise<FastifyInstance> {
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
