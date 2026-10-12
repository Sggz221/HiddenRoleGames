// Railway Infrastructure as Code (https://docs.railway.com/infrastructure-as-code).
// Preview: `pnpm railway:plan` · Apply: `pnpm railway:apply` (Railway CLI >= 5, after `railway link`).
//
// Mirrors the live project (configured initially via the Railway MCP/dashboard).
// Keep it in sync: anything omitted here is removed on apply.
//
// Environments map to Git Flow branches:
//   production -> main     (releases)   https://hiddenrolegames-production.up.railway.app
//   staging    -> develop  (integration) https://hiddenrolegames-staging.up.railway.app
//
// The service builds from the root Dockerfile (auto-detected by Railway).
import { defineRailway, github, project, service } from "railway/iac";

const REPO = "Sggz221/HiddenRoleGames";

export default defineRailway((ctx) => {
  const prod = ctx.isEnvironment("production");

  const app = service("HiddenRoleGames", {
    source: github(REPO, { branch: prod ? "main" : "develop" }),
    healthcheck: "/health",
    healthcheckTimeout: 60,
    // Game state lives in memory: never run more than one replica (see PLAN.md §7.2).
    replicas: { "europe-west4-drams3a": 1 },
    env: {
      NODE_ENV: "production",
      // Must match the generated domain's target port.
      PORT: "3000",
      LOG_LEVEL: prod ? "info" : "debug",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: Railway variable reference syntax
      PUBLIC_URL: "https://${{RAILWAY_PUBLIC_DOMAIN}}",
      // Hito 5: create a shared SENTRY_DSN variable in each environment, then:
      // SENTRY_DSN: ctx.shared.SENTRY_DSN,
    },
    // Once the custom domain exists (PLAN.md §7.3):
    // domains: prod ? ["aullidos.example"] : [],
  });

  // Current Railway project name; rename it in the dashboard and here together.
  return project("gleaming-wholeness", {
    resources: [app],
  });
});
