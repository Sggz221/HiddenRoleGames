# @aullidos/server

Servidor Fastify + Socket.IO autoritativo. Ver PLAN.md §1.3 y §4.3.

Contrato con la infraestructura:
- `build` genera `dist/index.js` (punto de entrada del contenedor).
- Escucha en `$PORT` (Railway lo inyecta; 3000 en local).
- Sirve estáticos desde `$STATIC_DIR` (`/app/public` en Docker; en dev no hace falta, lo sirve Vite).
- `GET /health` → 200 (healthcheck de Railway y de Docker).
- Maneja `SIGTERM` con apagado limpio.

_Pendiente de scaffolding en el Hito 0._
