# Protocolo cliente ↔ servidor

Transporte: **Socket.IO** en el mismo origen (`/socket.io`). Los tipos viven en `packages/shared` (`protocol.ts`, `game/*`). Todo payload del cliente se valida con Zod en el servidor.

> Pendiente: autenticación/sesión, reconexión con `sessionToken` (HID-5), configuración y arranque de partida desde la sala, y chat. Hasta que el lobby arranque partidas, un socket no está asociado a ninguna partida y `game:*` responde `NOT_IN_GAME`.

## Cliente → servidor

| Evento | Payload | Respuesta (ack) |
|---|---|---|
| `game:action` | `GameAction` (ver abajo) | `{ ok: true }` o `{ ok: false, code, message }` |
| `game:sync` | — | `{ ok }` y además un `game:view` con el estado actual |
| `room:create` | `{ name }` | `{ ok: true, playerId, room }` o error |
| `room:join` | `{ code, name }` | `{ ok: true, playerId, room }` o error |
| `room:leave` | — | `{ ok: true }` o `NOT_IN_ROOM` |

### Salas

- **Nombre:** 1-24 caracteres, sin caracteres de control; se recorta. Único en la sala sin distinguir mayúsculas.
- **Código:** 6 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin `0/O/1/I`), generado con `crypto.randomInt`, por tanto impredecible. Al unirse se acepta en minúsculas y con espacios alrededor.
- **Host:** quien crea la sala. Si se va, pasa al jugador más antiguo que queda. Si se va el último, la sala se destruye. Las salas sin actividad (entradas/salidas) durante 2 h se eliminan.
- **Capacidad:** `maxPlayers` = 20 (`MAX_PLAYERS`).
- **Límite de intentos:** solo cuentan los **fallos por código inexistente**: 10 en 60 s por cliente (IP; se usa la última entrada de `X-Forwarded-For`, la que añade el proxy de Railway). Superado, `TOO_MANY_ATTEMPTS` también para códigos válidos hasta que expire la ventana.
- **Un socket, una sala:** crear o unirse estando ya en una sala devuelve `ALREADY_IN_ROOM`.
- **Desconexión:** hasta que exista la gracia de reconexión (HID-5), perder la conexión equivale a salir de la sala.

### `GameAction`

| `type` | Campos | Quién / cuándo |
|---|---|---|
| `vote` | `target: id \| null` | Vivos, en elección de Alguacil, votación o desempate |
| `cupidLink` | `targets: [id, id]` | Cupido, noche 1 |
| `seerInspect` | `target` | Vidente |
| `wildChildModel` | `target` | Niño salvaje, noche 1 |
| `wolfHoundChoose` | `side: "village" \| "wolves"` | Perro lobo, noche 1 |
| `salvadorProtect` | `target` | Salvador (no el mismo dos noches seguidas) |
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
| `room:state` | `{ code, hostId, maxPlayers, players: [{ id, name }] }` a todos los miembros cuando cambia el lobby (entra o sale alguien, cambia el host). El jugador que se une lo recibe en el ack |
| `game:events` | `GameEventPayload[]` ya filtrados para ese jugador, en orden, para animar o narrar |
| `error` | `{ code, message }` |

- **Contador:** `phaseEndsAt` y `serverNow` permiten pintarlo bien aunque el reloj del móvil esté desfasado: `restante = phaseEndsAt - (serverNow + (Date.now() - recibidoEn))`.
- **Visibilidad:** `PlayerView` sale siempre de `projectFor` y nunca incluye información que el jugador no pueda conocer. Ver `docs/game-design.md`.

## Códigos de error

`INVALID_PAYLOAD`, `NOT_IN_GAME`, `NOT_ALLOWED`, `INVALID_TARGET`, `DUPLICATE_TARGET`, `POTION_USED`, `RATE_LIMITED`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `NAME_TAKEN`, `ALREADY_IN_ROOM`, `NOT_IN_ROOM`, `TOO_MANY_ATTEMPTS`, `INTERNAL`.
