# syntax=docker/dockerfile:1
#
# Single production image: Fastify + Socket.IO server that also serves the
# compiled web client (same origin, no CORS). Used by Railway and by
# `docker compose up` for prod-like local testing.
#
# Expected workspace contract (created in Hito 0):
#   - @aullidos/server  -> `build` emits apps/server/dist/index.js
#   - @aullidos/web     -> `build` emits apps/web/dist/
#   - The server serves static files from $STATIC_DIR and listens on $PORT.

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
# Install all dependencies (cached while manifests don't change).
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile
COPY . .
RUN pnpm install --frozen-lockfile --offline --ignore-scripts

# ---------------------------------------------------------------------------
# Build server + web (and their workspace deps) and prune to a prod bundle.
FROM deps AS build
RUN pnpm turbo run build --filter=@aullidos/server... --filter=@aullidos/web...
RUN pnpm --filter=@aullidos/server deploy --prod --legacy /out/server \
 && cp -r apps/web/dist /out/server/public

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/public
WORKDIR /app
COPY --from=build --chown=node:node /out/server ./
USER node
EXPOSE 3000
# Railway uses railway.json's healthcheck; this one is for local Docker.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Run node directly (not via pnpm) so SIGTERM reaches the process for graceful shutdown.
CMD ["node", "dist/index.js"]
