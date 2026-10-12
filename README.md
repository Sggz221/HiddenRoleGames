# Aullidos

Juego web multijugador de rol oculto (5-20 jugadores) en tiempo real. Ver [PLAN.md](PLAN.md).

## Requisitos

- Node.js 24 LTS (`.nvmrc`)
- pnpm 12 (`corepack enable` o `npm i -g pnpm@12`)
- Docker (opcional, para probar la imagen de producción)

## Empezar

```bash
pnpm install        # instala dependencias y los git hooks
cp .env.example .env
pnpm dev            # web en http://localhost:5173 (HMR) + servidor en :3000
```

Probar la build de producción tal como corre en Railway:

```bash
pnpm docker:up      # http://localhost:3000
```

## Estructura

```
apps/web            cliente React + Vite
apps/server         Fastify + Socket.IO (sirve también la web compilada)
packages/shared     protocolo, tipos y esquemas Zod
packages/game-engine reglas puras del juego
packages/bots       bots para tests y carga
packages/tsconfig   configs TS compartidas
docs/               diseño, protocolo, ADRs, flujo git
infra/              documentación de entornos y despliegue
scripts/            utilidades del repo
.railway/           infraestructura de Railway como código
```

## Flujo de trabajo

Git Flow: `main` (producción) · `develop` (staging) · `feature/*` · `release/*` · `hotfix/*`.
Detalles en [docs/git-workflow.md](docs/git-workflow.md). Entornos y despliegue en [infra/README.md](infra/README.md).
