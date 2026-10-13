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
- `src/features/game/`: la partida (HID-22).
  - **Reloj de la aldea** (`daytime.ts`, `useGameClock.ts`): cada fase cubre un tramo del día (noche 21–05, alguacil 06–08, debate 08–15, votación 15–18). La hora avanza con el contador y da la paleta (cielo, tierra, resplandor, estrellas, ventanas). Se escribe en variables CSS sin renderizar React; los saltos de fase se deslizan con GSAP.
  - **Tema del rol** (`roleTheme.ts`): `--accent`, `--on-accent` y `--tint`. La manada en rojo sobre negro con Grenze Gotisch; cada rol del pueblo con su color.
  - `TopBar`: día y turno (animados), chip del rol con el objetivo, botones de efectos/música/ajustes y la esfera del reloj con el contador.
  - `PlayersTable` + `ActionDock` comparten `useActionController`. Los objetivos se eligen tocando a los jugadores (respiran cuando se pueden elegir); el resto de controles van en el dock.
  - `ChatDrawer` (panel lateral con pestañas por canal), `HistoryPanel` (historial abajo, desplegable), `RoleReveal` (la carta al empezar, que vuela al chip) y `ResultPanel`.
  - Ajustes: "Reducir animaciones" (`preferences.ts`) se suma a `prefers-reduced-motion` mediante `MotionConfig` y `data-reduce-motion`.
  - La lógica pura vive en `model.ts`, `daytime.ts` y `roleTheme.ts`, con tests.
- `src/animations/` (Hito 4):
  - `scenesFor` convierte cada lote de `game:events` en escenas (amanecer, muertes de día) y `SceneQueue` las reproduce de una en una. Son solo visuales: el estado ya está aplicado, así que saltarlas no cambia nada.
  - `DeathOverlay` (Motion): anuncia las muertes a pantalla completa; se salta tocando o con "Saltar".
  - `Landscape`: el pueblo de fondo (cielo, estrellas, sol y luna en su arco, colinas, pino y casa con ventanas que se encienden de noche), pintado con los colores del reloj.
  - Con `prefers-reduced-motion` (o "Reducir animaciones") no hay movimiento: el reloj salta sin deslizarse y Motion solo conserva los fundidos.
- Textos en `src/i18n/locales/es.json`. Los tests comprueban que existen todos los textos de narración y de error.

