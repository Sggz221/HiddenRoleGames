# @aullidos/web

Cliente React + Vite (mobile-first). Ver PLAN.md §1.2 y §4.5.

Contrato con la infraestructura:
- `pnpm --filter @aullidos/web dev` → Vite en http://localhost:5173 con proxy de `/socket.io` y `/health` al servidor (:3000).
- `build` genera `dist/`, que el Dockerfile copia a `/app/public` y sirve el servidor.

_Pendiente de scaffolding en el Hito 0._
