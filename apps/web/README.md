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
- `src/features/game/`: la partida.
  - `PhaseBar`: noche/día, paso y contador sincronizado con el reloj del servidor (`phaseEndsAt`, desfase `serverNow`).
  - `ActionPanel`: pinta exactamente `view.pending`. Un formulario por tipo de acción (objetivo, pareja, hasta dos, bando, infección, bruja) y "Pasar" cuando se permite. Los objetivos son los del servidor.
  - `PlayerList`: vivos y muertos, lo que puedes saber (alguacil, manada, pareja, hechizo, roles visibles) y los votos en vivo.
  - `YourCard`, `NarratorFeed` y `ResultPanel` (ganadores y cartas de todos hasta volver a la sala).
  - La lógica pura vive en `model.ts`: contador, recuento de votos y construcción de acciones.
- Audio: la música sigue la fase y los efectos siguen los `game:events` (`net/client.ts`).
- Textos en `src/i18n/locales/es.json`. Los tests comprueban que existen todos los textos de narración y de error.

