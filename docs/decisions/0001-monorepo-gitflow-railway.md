# ADR 0001: Monorepo, Git Flow y despliegue en Railway

- **Estado:** aceptada
- **Fecha:** 2026-10-12

## Contexto

PLAN.md fija un monorepo pnpm + Turborepo con un único servicio en producción (web compilada + WebSocket). Se necesita un flujo que permita probar con amigos antes de publicar y probar el frontend en local.

## Decisión

1. **Git Flow** con `main` (producción) y `develop` (staging); ramas `feature/*`, `release/*`, `hotfix/*`. Ver `docs/git-workflow.md`.
2. **Node 24 LTS** (`.nvmrc`, `engines`, imagen `node:24-slim`) y **pnpm 12** fijado en `packageManager`.
3. **Railway con Infrastructure as Code** (`.railway/railway.ts`). `railway.json` (Config as Code) está obsoleto y deja de leerse el 2026-12-01, por lo que no se usa.
4. **Dos entornos Railway** en el mismo proyecto: `production` ← `main`, `staging` ← `develop`. Una réplica (estado en memoria).
5. **Local:** `pnpm dev` (HMR) para el día a día; `docker compose` para validar la imagen real antes de una release.
6. **Imagen:** multi-stage, `pnpm deploy --prod --legacy` para empaquetar solo el servidor y sus dependencias de producción, usuario no root, `node` como PID 1 para recibir `SIGTERM`.

## Consecuencias

- El primer despliegue fallará hasta que el Hito 0 cree `apps/server` con `/health`.
- `pnpm deploy --legacy` evita tener que activar `injectWorkspacePackages` en desarrollo; si pnpm lo retira, migrar a `injectWorkspacePackages: true`.
