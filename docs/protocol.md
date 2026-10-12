# Protocolo cliente ↔ servidor

Transporte: **Socket.IO** en el mismo origen (`/socket.io`). Los tipos viven en `packages/shared` (`protocol.ts`, `game/*`). Todo payload del cliente se valida con Zod en el servidor.

> Pendiente para el próximo hito: autenticación/sesión, salas (`room:*`) y chat. Hasta entonces, un socket no está asociado a ninguna partida y `game:*` responde `NOT_IN_GAME`.

## Cliente → servidor

| Evento | Payload | Respuesta (ack) |
|---|---|---|
| `game:action` | `GameAction` (ver abajo) | `{ ok: true }` o `{ ok: false, code, message }` |
| `game:sync` | — | `{ ok }` y además un `game:view` con el estado actual |

### `GameAction`

| `type` | Campos | Quién / cuándo |
|---|---|---|
| `vote` | `target: id \| null` | Vivos, en elección de Alguacil, votación o desempate |
| `cupidLink` | `targets: [id, id]` | Cupido, noche 1 |
| `seerInspect` | `target` | Vidente |
| `wildChildModel` | `target` | Niño salvaje, noche 1 |
| `wolfHoundChoose` | `side: "village" \| "wolves"` | Perro lobo, noche 1 |
| `wolfVote` | `target` | Manada |
| `infect` | `infect: boolean` | Padre de los lobos (una vez) |
| `bigBadWolfKill` | `target` | Gran lobo feroz |
| `whiteWolfKill` | `target` | Lobo blanco, noches pares |
| `witch` | `heal: id \| null, poison: id \| null` | Bruja |
| `foxSniff` | `target` | Zorro |
| `piperCharm` | `targets: id[]` (1-2) | Flautista |
| `hunterShoot` | `target` | Cazador (reacción) |
| `sheriffSuccessor` | `target` | Alguacil muerto (reacción) |
| `sheriffTieBreak` | `target: id \| null` | Alguacil, si `voteTieRule = "sheriff"` |
| `skip` | — | Renunciar a una acción opcional |

- **Qué se puede enviar:** las acciones válidas en cada momento vienen en `view.pending` (`types` y `targets`). El cliente solo tiene que pintar eso.
- **Cambiar de idea:** reenviar una acción antes de que acabe el temporizador sustituye a la anterior.

## Servidor → cliente

| Evento | Payload |
|---|---|
| `game:view` | `{ view: PlayerView, phaseEndsAt, serverNow }` |
| `game:events` | `GameEventPayload[]` ya filtrados para ese jugador, en orden, para animar o narrar |
| `error` | `{ code, message }` |

- **Contador:** `phaseEndsAt` y `serverNow` permiten pintarlo bien aunque el reloj del móvil esté desfasado: `restante = phaseEndsAt - (serverNow + (Date.now() - recibidoEn))`.
- **Visibilidad:** `PlayerView` sale siempre de `projectFor` y nunca incluye información que el jugador no pueda conocer. Ver `docs/game-design.md`.

## Códigos de error

`INVALID_PAYLOAD`, `NOT_IN_GAME`, `NOT_ALLOWED`, `INVALID_TARGET`, `DUPLICATE_TARGET`, `POTION_USED`, `RATE_LIMITED`, `INTERNAL`.
