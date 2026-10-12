import { healthResponseSchema } from "@aullidos/shared";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "./app.js";

describe("http app", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("GET /health returns a valid health payload", async () => {
    app = await buildApp(loadEnv({ NODE_ENV: "test" }));
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json()).status).toBe("ok");
  });

  it("returns 404 for unknown routes when no static dir is configured", async () => {
    app = await buildApp(loadEnv({ NODE_ENV: "test" }));
    const response = await app.inject({ method: "GET", url: "/nope" });

    expect(response.statusCode).toBe(404);
  });
});
