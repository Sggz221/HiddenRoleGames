# Infraestructura

| Pieza | Archivo | Notas |
|---|---|---|
| Imagen de producción | [`/Dockerfile`](../Dockerfile) | Multi-stage: build de `web` + `server`, `pnpm deploy --prod`, usuario `node` |
| Entorno local tipo producción | [`/docker-compose.yml`](../docker-compose.yml) | `pnpm docker:up` → http://localhost:3000 · perfil `db` para PostgreSQL (fase 2) |
| Railway (IaC) | [`/.railway/railway.ts`](../.railway/railway.ts) | `production` ← `main`, `staging` ← `develop` |
| CI | [`/.github/workflows`](../.github/workflows) | `ci.yml`, `branch-policy.yml`, `e2e.yml` |

## Entornos

| Entorno | Rama | Cómo se despliega | URL |
|---|---|---|---|
| Local (HMR) | cualquiera | `pnpm dev` (Vite :5173 + server :3000) | http://localhost:5173 |
| Local (prod-like) | cualquiera | `pnpm docker:up` | http://localhost:3000 |
| Staging | `develop` | Auto-deploy de Railway al hacer push | https://hiddenrolegames-staging.up.railway.app |
| Producción | `main` | Auto-deploy de Railway al hacer merge de `release/*` o `hotfix/*` | https://hiddenrolegames-production.up.railway.app (dominio propio en §7.3) |

## Railway: estado actual

- **Proyecto:** `gleaming-wholeness` (workspace "Samuel's Projects"). Renombrar a `aullidos` en el dashboard y en `.railway/railway.ts` a la vez.
- **Servicio:** `HiddenRoleGames`, construido desde el `Dockerfile` raíz, 1 réplica en `europe-west4-drams3a`.
- **Healthcheck:** `GET /health` (60 s). Reinicio `ON_FAILURE` (5 reintentos). Drenado de 20 s para el apagado limpio.
- **Variables:** `NODE_ENV=production`, `PORT=3000` (coincide con el puerto del dominio), `LOG_LEVEL` (`info` en prod, `debug` en staging), `PUBLIC_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}`.
- **Watch patterns:** solo redepliega si cambian `apps/**`, `packages/**`, `Dockerfile` o los manifiestos de pnpm/turbo.

### Pendiente (manual, en el dashboard)

1. Configurar el **límite de gasto** del proyecto (Settings → Usage).
2. Activar **"Wait for CI"** en el servicio, en ambos entornos, para que solo despliegue si GitHub Actions pasa.
3. Opcional: **PR environments** para previsualizar cada PR.
4. Para usar `pnpm railway:plan/apply` hace falta la CLI de Railway ≥ 5 (`railway config ...`).

## Puesta en marcha desde cero (si hubiera que recrearlo)

1. `railway login` y crear un proyecto **independiente** con su **límite de gasto**.
2. Conectar el repo `Sggz221/HiddenRoleGames` a un servicio y crear el entorno `staging` duplicando `production`.
3. `railway link` en la raíz del repo y `pnpm railway:plan` → revisar → `pnpm railway:apply` en cada entorno.
4. Generar un dominio público por entorno con puerto destino 3000.

## Variables de entorno

Ver [`/.env.example`](../.env.example). En Railway se gestionan desde `.railway/railway.ts`; los secretos se añaden en el dashboard y se referencian con `preserve()` o variables compartidas.
