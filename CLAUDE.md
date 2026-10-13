# Howls in the Dark: instrucciones para Claude

## Qué es
Nombre público: **Howls in the Dark** (constante `APP_NAME` en `packages/shared`). "Aullidos" fue el nombre de trabajo y se mantiene en el código interno (`@aullidos/*`).
Juego web multijugador de rol oculto (tipo "Hombres Lobo"). Monorepo pnpm + Turborepo.
Lee PLAN.md para el contexto completo antes de proponer cambios de arquitectura.

## Comandos
- `pnpm dev`: web + servidor con recarga
- `pnpm test`: tests (Vitest) de todo el monorepo
- `pnpm lint` / `pnpm typecheck` / `pnpm build`
- `pnpm infra:up` / `pnpm infra:down`: PostgreSQL + Redis locales (Docker)
- `pnpm db:generate` / `pnpm db:migrate`: migraciones Drizzle (`apps/server/drizzle/`)
- `pnpm docker:up`: imagen de producción + infra en http://localhost:3000
- `pnpm railway:plan` / `pnpm railway:apply`: infraestructura de Railway (`.railway/railway.ts`)

## Ramas (Git Flow, ver docs/git-workflow.md)
- Nunca commitear directamente en `main` ni `develop`.
- Trabajo nuevo: `feature/<hito>-<tema>` desde `develop`, PR a `develop`.
- Commits con Conventional Commits (`feat(engine): ...`).

## Reglas de oro
1. El servidor es la única fuente de verdad. El cliente nunca decide reglas.
2. La lógica del juego vive SOLO en `packages/game-engine` y es pura (sin I/O, sin Date.now(), sin Math.random(); usar Rng inyectado).
3. Nunca enviar `GameState` completo al cliente: solo `projectFor(state, viewer)`.
4. Todo payload de red tiene esquema Zod en `packages/shared` y se valida en servidor.
5. Toda regla o rol nuevo lleva tests, incluyendo casos límite.
6. TypeScript estricto: sin `any` ni `@ts-ignore` sin justificación comentada.
7. Cambios pequeños y enfocados; un tema por commit/PR.
8. Textos de usuario en `i18n`, nunca hardcodeados en componentes.
9. Respetar `prefers-reduced-motion` en toda animación nueva.

## Contrato con la infraestructura
- Paquetes: `@aullidos/{web,server,shared,game-engine,bots,tsconfig}`.
- `server` compila a `apps/server/dist/index.js`, escucha en `$PORT`, sirve estáticos desde `$STATIC_DIR`, expone `GET /health` (liveness) y `GET /health/ready`, y maneja `SIGTERM`.
- `DATABASE_URL` (Postgres, historial) y `REDIS_URL` (snapshots de partidas + adaptador Socket.IO) son opcionales; sin ellos todo funciona en memoria.
- Migraciones: `node dist/persistence/migrate.js` (pre-deploy en Railway). Nunca editar una migración ya aplicada: generar otra.
- `GameSession` (`apps/server/src/game`) es el único puente entre el motor y la red.
- `web` compila a `apps/web/dist/`; en dev, Vite (:5173) hace proxy de `/socket.io` y `/health` a :3000.
- Si cambias esto, actualiza `Dockerfile`, `infra/README.md` y este archivo.

## Antes de dar algo por terminado
Ejecutar lint, typecheck y tests. Si cambia el protocolo, actualizar `docs/protocol.md`.
Si se toma una decisión de arquitectura, añadir un ADR en `docs/decisions/`.

## Estilo
Código y comentarios en inglés; documentación de diseño y textos del juego en español.
