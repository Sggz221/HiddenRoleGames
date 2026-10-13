# ADR 0002: PostgreSQL y Redis desde el principio

- **Estado:** aceptada
- **Fecha:** 2026-10-12
- **Sustituye en parte a:** PLAN.md §1.4 (estado solo en memoria en el MVP)

## Contexto

PLAN.md proponía estado en memoria en el MVP, Postgres en la fase 2 y Redis "solo si hace falta". Se decide preparar el backend desde ya para cuentas, historial y para no perder partidas en los despliegues.

## Decisión

1. **Redis** guarda una *snapshot* (`GameState` + `phaseEndsAt`) de cada partida en curso tras cada cambio (clave `howlsinthedark:game:{id}`, TTL configurable).
   - Al arrancar, `GameRegistry.restoreAll()` reanuda las partidas.
   - Si una fase venció mientras el servidor estaba caído, avanza al momento.
2. **Redis** también es el adaptador de Socket.IO (`@socket.io/redis-adapter`), preparado para varias instancias.
3. **PostgreSQL** (Drizzle ORM + `postgres.js`) guarda las partidas terminadas (`games`, `game_players`), con el estado final completo para repeticiones y disputas.
   - Las migraciones se versionan en `apps/server/drizzle/`.
   - Se aplican con `node dist/persistence/migrate.js` como *pre-deploy command* de Railway.
4. **Las dos dependencias son opcionales:** sin `REDIS_URL` el estado vive en memoria y sin `DATABASE_URL` no hay historial. Así `pnpm dev` funciona sin Docker.
5. **Salud:**
   - `GET /health` sigue siendo de *liveness* (healthcheck de Railway).
   - `GET /health/ready` comprueba Postgres y Redis.

## Consecuencias

- **Una sola réplica:** se sigue usando, porque los temporizadores de fase viven en el proceso que reanuda la partida. Escalar a varias instancias requiere asignar cada partida a una instancia (lock en Redis) antes de subir réplicas.
- **Coste:** dos servicios más en Railway (Postgres y Redis) en cada entorno.
- **Tamaño de la snapshot:** el estado es pequeño (decenas de KB como mucho), así que se puede guardar en cada cambio.
