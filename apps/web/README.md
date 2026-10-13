# @howlsinthedark/web

Cliente React + Vite (mobile-first). Ver PLAN.md §1.2 y §4.5.

Contrato con la infraestructura:
- `pnpm --filter @howlsinthedark/web dev` → Vite en http://localhost:5173 con proxy de `/socket.io` y `/health` al servidor (:3000).
- `build` genera `dist/`, que el Dockerfile copia a `/app/public` y sirve el servidor.

## Estructura

- `src/net/`: conexión con el servidor.
  - `session.ts` (`SessionStore`) guarda el asiento del jugador: sala, vista de partida y narración. Solo envía intenciones y guarda lo que dice el servidor. Tras cada (re)conexión reanuda el asiento con el `sessionToken` guardado en `localStorage` (ADR 0003).
  - `client.ts` crea el socket real.
  - `useSession()` lo expone a React.
- `src/features/lobby/`:
  - Portada con nombre, crear sala y unirse. El enlace `/?sala=CODIGO` rellena el código.
  - Lobby: código con copiar/compartir, lista de jugadores y ajustes del anfitrión.
  - Los ajustes (`settings.ts`) se guardan en el dispositivo del anfitrión y se envían con `room:start`. Los demás no los ven todavía.
- `src/features/game/`: pantalla de partida mínima (tu carta y el narrador). La completa es HID-10.
- Textos en `src/i18n/locales/es.json`. Los tests comprueban que existen todos los textos de narración y de error.

