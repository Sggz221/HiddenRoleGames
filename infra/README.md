# Infraestructura

| Pieza | Archivo | Notas |
|---|---|---|
| Imagen de producción | [`/Dockerfile`](../Dockerfile) | Multi-stage: build de `web` + `server`, `pnpm deploy --prod`, usuario `node` |
| Entorno local | [`/docker-compose.yml`](../docker-compose.yml) | `pnpm infra:up` → PostgreSQL :5432 + Redis :6379 · `pnpm docker:up` → todo + imagen de producción en http://localhost:3000 |
| Railway (IaC) | [`/.railway/railway.ts`](../.railway/railway.ts) | `production` ← `main`, `development` ← `develop` |
| CI | [`/.github/workflows`](../.github/workflows) | `ci.yml`, `branch-policy.yml`, `e2e.yml` |

## Entornos

| Entorno | Rama | Cómo se despliega | URL |
|---|---|---|---|
| Local (HMR) | cualquiera | `pnpm infra:up` + `pnpm db:migrate` + `pnpm dev` (Vite :5173 + server :3000) | http://localhost:5173 |
| Local (prod-like) | cualquiera | `pnpm docker:up` | http://localhost:3000 |
| Development | `develop` | Auto-deploy de Railway al hacer push | https://hiddenrolegames-staging.up.railway.app |
| Producción | `main` | Auto-deploy de Railway al hacer merge de `release/*` o `hotfix/*` | https://hiddenrolegames-production.up.railway.app (dominio propio en §7.3) |

## Railway: estado actual

- **Proyecto:** `gleaming-wholeness` (workspace "Samuel's Projects"). Renombrar a `howlsinthedark` en el dashboard y en `.railway/railway.ts` a la vez.
- **Servicio:** `HiddenRoleGames`, construido desde el `Dockerfile` raíz, 1 réplica en `europe-west4-drams3a`.
- **Healthcheck:** `GET /health` (60 s). Reinicio `ON_FAILURE` (5 reintentos). Drenado de 20 s para el apagado limpio.
- **Variables:** `NODE_ENV=production`, `PORT=3000` (coincide con el puerto del dominio), `LOG_LEVEL` (`info` en prod, `debug` en development), `PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`.
- **Watch patterns:** solo redepliega si cambian `apps/**`, `packages/**`, `Dockerfile` o los manifiestos de pnpm/turbo.

> **Pendiente de renombrar en Railway:** el entorno `development` se creó como `staging`. Renombrarlo en el dashboard (Environments → ⋯ → Rename); no cambia sus servicios, variables ni dominio. Quitar esta nota después.

### Bases de datos

Creadas el 2026-10-12 desde las plantillas oficiales, en `europe-west4`, con volumen persistente. Ver [ADR 0002](../docs/decisions/0002-postgres-redis-from-start.md).

| Entorno | PostgreSQL | Redis |
|---|---|---|
| production | `Postgres` | `Redis` |
| development | `Postgres-rBwq` | `Redis-Ikfu` |

- **Conexión:** `HiddenRoleGames` recibe `DATABASE_URL` y `REDIS_URL` como referencias (`${{Postgres.DATABASE_URL}}`, …) por la red privada.
- **Migraciones:** *pre-deploy command* `node dist/persistence/migrate.js`. Si falla, el despliegue se cancela.
- **Nombres de development:** llevan sufijo porque en Railway los nombres de servicio son únicos dentro del proyecto. Se pueden renombrar en el dashboard (actualizando las referencias y `.railway/railway.ts`).

### Pendiente (manual, en el dashboard)

1. Configurar el **límite de gasto** del proyecto (Settings → Usage).
2. Activar **"Wait for CI"** en el servicio, en ambos entornos, para que solo despliegue si GitHub Actions pasa.
3. Opcional: **PR environments** para previsualizar cada PR.
4. Para usar `pnpm railway:plan/apply` hace falta la CLI de Railway ≥ 5 (`railway config ...`).

## Puesta en marcha desde cero (si hubiera que recrearlo)

1. `railway login` y crear un proyecto **independiente** con su **límite de gasto**.
2. Conectar el repo `Sggz221/HiddenRoleGames` a un servicio y crear el entorno `development` duplicando `production`.
3. `railway link` en la raíz del repo y `pnpm railway:plan` → revisar → `pnpm railway:apply` en cada entorno.
4. Generar un dominio público por entorno con puerto destino 3000.

## Variables de entorno

Ver [`/.env.example`](../.env.example). En Railway se gestionan desde `.railway/railway.ts`; los secretos se añaden en el dashboard y se referencian con `preserve()` o variables compartidas.
