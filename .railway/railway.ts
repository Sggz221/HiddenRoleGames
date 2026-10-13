// Railway Infrastructure as Code (https://docs.railway.com/infrastructure-as-code).
// Preview: `pnpm railway:plan` · Apply: `pnpm railway:apply` (Railway CLI >= 5, after `railway link`).
//
// Mirrors the live project (configured initially via the Railway MCP/dashboard).
// Keep it in sync: anything omitted here is removed on apply.
//
// Environments map to Git Flow branches:
//   production -> main     (releases)   https://hiddenrolegames-production.up.railway.app
//   development    -> develop  (integration) https://hiddenrolegames-staging.up.railway.app
//
// The service builds from the root Dockerfile (auto-detected by Railway).
import { defineRailway, github, postgres, project, redis, service } from "railway/iac";

const REPO = "Sggz221/HiddenRoleGames";

export default defineRailway((ctx) => {
  const prod = ctx.isEnvironment("production");

  // Service names are unique per project, so development got suffixed names when its
  // databases were created from the official templates.
  const db = postgres(prod ? "Postgres" : "Postgres-rBwq");
  const cache = redis(prod ? "Redis" : "Redis-Ikfu");

  const app = service("HiddenRoleGames", {
    source: github(REPO, { branch: prod ? "main" : "develop" }),
    healthcheck: "/health",
    healthcheckTimeout: 60,
    preDeploy: "node dist/persistence/migrate.js",
    // Phase timers live in the process that owns the game: one replica (ADR 0002).
    replicas: { "europe-west4-drams3a": 1 },
    env: {
      NODE_ENV: "production",
      // Must match the generated domain's target port.
      PORT: "3000",
      LOG_LEVEL: prod ? "info" : "debug",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Railway variable reference syntax
      PUBLIC_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      // Hito 5: create a shared SENTRY_DSN variable in each environment, then:
      // SENTRY_DSN: ctx.shared.SENTRY_DSN,
    },
    // Once the custom domain exists (PLAN.md §7.3):
    // domains: prod ? ["howlsinthedark.example"] : [],
  });

  // Current Railway project name; rename it in the dashboard and here together.
  return project("gleaming-wholeness", {
    resources: [app, db, cache],
  });
});
