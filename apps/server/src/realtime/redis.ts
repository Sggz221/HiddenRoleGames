import { Redis } from "ioredis";
import type { Logger } from "../game/session.js";

export function connectRedis(url: string, log: Logger, name: string): Redis {
  const redis = new Redis(url, {
    connectionName: `aullidos:${name}`,
    maxRetriesPerRequest: 3,
    // Railway's private network is IPv6-only.
    family: 0,
  });
  redis.on("error", (err) => log.error({ err, connection: name }, "redis error"));
  return redis;
}

export async function pingRedis(redis: Redis): Promise<boolean> {
  try {
    return (await redis.ping()) === "PONG";
  } catch {
    return false;
  }
}
