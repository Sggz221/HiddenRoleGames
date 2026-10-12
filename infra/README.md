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
| Staging | `develop` | Auto-deploy de Railway al hacer push | dominio `*.up.railway.app` del entorno staging |
| Producción | `main` | Auto-deploy de Railway al hacer merge de `release/*` o `hotfix/*` | dominio propio (§7.3) |

## Puesta en marcha de Railway (una vez, manual)

1. Instalar la CLI de Railway y autenticarse: `railway login`.
2. Crear un proyecto **nuevo e independiente** llamado `aullidos` y configurar su **límite de gasto**.
3. Crear el entorno `staging` además de `production`.
4. En la raíz del repo: `railway link` (elegir proyecto y entorno).
5. `pnpm railway:plan` → revisar → `pnpm railway:apply`. Repetir con el otro entorno (`railway environment staging`).
6. Generar un dominio público para cada entorno (Settings → Networking) y, más adelante, el dominio propio con Cloudflare.
7. Activar "Wait for CI" en el servicio para que solo despliegue si GitHub Actions pasa.

> El primer despliegue fallará hasta que el Hito 0 cree `apps/server` con `/health`. Es esperado.

## Variables de entorno

Ver [`/.env.example`](../.env.example). En Railway se gestionan desde `.railway/railway.ts`; los secretos se añaden en el dashboard y se referencian con `preserve()` o variables compartidas.
