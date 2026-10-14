# Protocolo cliente ↔ servidor

Transporte: **Socket.IO** en el mismo origen (`/socket.io`). Los tipos viven en `packages/shared` (`protocol.ts`, `game/*`). Todo payload del cliente se valida con Zod en el servidor.

> Pendiente: autenticación con cuentas e historial de chat al reconectar. Un socket que no está en una partida en curso recibe `NOT_IN_GAME` en `game:*`.

## Cliente → servidor

| Evento | Payload | Respuesta (ack) |
|---|---|---|
| `game:action` | `GameAction` (ver abajo) | `{ ok: true }` o `{ ok: false, code, message }` |
| `game:sync` | — | `{ ok }` y además un `game:view` con el estado actual |
| `room:create` | `{ name }` | `{ ok: true, playerId, sessionToken, room }` o error |
| `room:join` | `{ code, name }` | `{ ok: true, playerId, sessionToken, room }` o error |
| `room:leave` | — | `{ ok: true }` o `NOT_IN_ROOM` |
| `room:start` | `RoomStart` (ver abajo) | `{ ok: true }` o error. Solo el anfitrión |
| `chat:send` | `{ channel, text }` | `{ ok: true }` o error |
| `session:resume` | `{ token }` | `{ ok: true, playerId, room, gameId }` o error; si hay partida, después llega un `game:view` |

### Salas

- **Nombre:** 1-24 caracteres, sin caracteres de control; se recorta. Único en la sala sin distinguir mayúsculas.
- **Código:** 6 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin `0/O/1/I`), generado con `crypto.randomInt`, por tanto impredecible. Al unirse se acepta en minúsculas y con espacios alrededor.
- **Host:** quien crea la sala. Si se va, pasa al jugador más antiguo que queda. Si se va el último, la sala se destruye. Las salas sin actividad (entradas/salidas) durante 2 h se eliminan.
- **Capacidad:** `maxPlayers` = 20 (`MAX_PLAYERS`).
- **Límite de intentos:** solo cuentan los **fallos por código inexistente**: 10 en 60 s por cliente (IP; se usa la última entrada de `X-Forwarded-For`, la que añade el proxy de Railway). Superado, `TOO_MANY_ATTEMPTS` también para códigos válidos hasta que expire la ventana.
- **Un socket, una sala:** crear o unirse estando ya en una sala devuelve `ALREADY_IN_ROOM`.

### Arranque de partida (`room:start`)

- **Quién:** solo el anfitrión, con al menos `MIN_PLAYERS` (5) jugadores sentados. Entran todos los miembros de la sala, también los que están dentro de su periodo de gracia.
- **Payload:** cualquier campo de `GameConfig`, todos opcionales (`roles`, `sheriff`, `revealOnDeath`, `voteTieRule`, `deadSeeEverything`, `maxDays`, `timers`). Sin `roles` se usa `recommendedDeck(jugadores)`. Si se manda la baraja, debe tener **una carta por jugador** y cumplir las reglas (`validateDeck`).
- **Orden de los asientos:** el de entrada en la sala. El motor baraja las cartas.
- **Qué llega:** un `room:state` con `gameId` y después el primer `game:view` de cada jugador.
- **Durante la partida:** nadie puede unirse (`GAME_IN_PROGRESS`) ni arrancar otra. La sala no caduca por inactividad.
- **Al terminar:** tras el último `game:view` (con `result`), la sala vuelve al lobby: `room:state` con `gameId: null`. El anfitrión puede arrancar la revancha. Los jugadores desconectados vuelven a tener el periodo de gracia del lobby.
- **Errores:** `INVALID_PAYLOAD` (campo mal formado o fuera de rango), `NOT_IN_ROOM`, `NOT_ALLOWED` (no eres el anfitrión), `GAME_IN_PROGRESS`, `NOT_ENOUGH_PLAYERS`, `INVALID_CONFIG` (baraja que no encaja o rompe reglas).

### Chat (`chat:send`)

Decisión completa en [ADR 0004](decisions/0004-chat-por-canales.md).

| Canal | Escriben | Leen |
|---|---|---|
| `general` | Los vivos, de día (y en reacciones: disparo del Cazador, sucesión del Alguacil). En el lobby y al acabar, todos | Todos, vivos y muertos |
| `wolves` | La manada viva (lobos, infectados, Niño salvaje transformado...), de noche | La manada viva. Los muertos si `deadSeeEverything` |
| `dead` | Los muertos | Los muertos |
| `lovers` | Los dos enamorados vivos | Los enamorados. Los muertos si `deadSeeEverything`. Cupido no |

- **Quién puede escribir/leer ahora:** `view.chat = { write, read }` en cada `game:view`. El cliente solo pinta esas pestañas; el servidor vuelve a comprobarlo en cada mensaje.
- **Lobby:** solo existe `general`, para todos los miembros de la sala.
- **Al acabar la partida:** todos leen todos los canales y solo `general` queda abierto.
- **Texto:** se recorta; de 1 a `CHAT_MESSAGE_MAX_LENGTH` (300) caracteres. Sin caracteres de control (tampoco saltos de línea) ni marcas de dirección bidi. Los emoji, incluidos los compuestos, sí.
- **Límite de ritmo:** por socket, ráfaga de 5 mensajes y después 1 cada 2 s (`RATE_LIMITED`).
- **Sin historial:** los mensajes no se guardan. Quien reconecta solo recibe los nuevos.
- **Errores:** `INVALID_PAYLOAD`, `NOT_IN_ROOM`, `RATE_LIMITED`, `NOT_ALLOWED` (canal cerrado para ti ahora mismo; también si el estado cambió entre tu vista y el mensaje).

### Reconexión (`sessionToken`)

Decisión completa en [ADR 0003](decisions/0003-reconexion-sessiontoken.md).

- **Guardar el token:** el cliente guarda el `sessionToken` de `room:create`/`room:join` (p. ej. en `localStorage`) y, al reconectar, envía `session:resume { token }` antes de nada.
- **Lobby:** al perder la conexión el asiento se conserva `RECONNECT_GRACE_SECONDS` (60 s por defecto) y `room:state` lo marca con `connected: false`. Si no vuelve, se libera (con traspaso de host si era el anfitrión).
- **Partida:** el asiento se conserva mientras dure; la falta de acción cuenta como "sin acción" al vencer cada fase.
- **Varias conexiones:** se pueden abrir varias pestañas con el mismo token; el jugador está offline cuando se cierra la última.
- **Salir a propósito** (`room:leave`) libera el asiento al instante y el token deja de valer.
- **Errores:** `INVALID_PAYLOAD` (token mal formado), `SESSION_NOT_FOUND` (token desconocido, expirado o revocado), `ALREADY_IN_ROOM` (esa conexión ya tiene asiento).
- **Limitación actual:** los tokens están en memoria; tras reiniciar el servidor no se pueden reanudar aunque la partida sí se restaure.

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
| `skip` | — | Renunciar a una acción opcional. Retira lo que el jugador hubiera elegido en ese paso |

- **Qué se puede enviar:** las acciones válidas en cada momento vienen en `view.pending` (`types` y `targets`). El cliente solo tiene que pintar eso.
- **Cambiar de idea:** reenviar una acción antes de que acabe el temporizador sustituye a la anterior.

## Servidor → cliente

| Evento | Payload |
|---|---|
| `game:view` | `{ view: PlayerView, phaseEndsAt, serverNow }`. Solo se envía cuando la vista de ese jugador cambia (si no, de noche se sabría cuándo actúa cada rol). `view.you.choice` es lo que el jugador ha elegido en la fase actual (`GameAction` o `null`), así se conserva al recargar |
| `room:state` | `{ code, hostId, maxPlayers, gameId, players: [{ id, name, connected }] }` a todos los miembros cuando cambia el lobby (entra o sale alguien, cambia el host, empieza o acaba una partida). El jugador que se une lo recibe en el ack |
| `game:events` | `GameEventPayload[]` ya filtrados para ese jugador, en orden, para animar o narrar. `dawn` marca el fin de la noche; las muertes que siguen en el mismo lote son las de esa noche |
| `game:narration` | `NarrationLine[]` (`{ key, params }`): lo que dice el narrador sobre ese mismo lote. Se construye solo con los eventos que recibió el jugador. El texto es `narration.<key>` en i18n; `params` trae jugadores (`{ id, name }`), `actor` (quien actuó, en las líneas `witness.*`), `role`, `side`, `count` y `day`. Los eventos privados nombran a quien actuó (`seerResult.seer`, `foxResult.fox`, `wildChildModelChosen.child`, `wildChildTransformed.child`, `wolfHoundChose.hound`, `elderResisted.elder`) |
| `chat:message` | `{ id, channel, from, name, text, sentAt }` solo a quien puede leer ese canal |
| `error` | `{ code, message }` |

- **Contador:** `phaseEndsAt` y `serverNow` permiten pintarlo bien aunque el reloj del móvil esté desfasado: `restante = phaseEndsAt - (serverNow + (Date.now() - recibidoEn))`.
- **Visibilidad:** `PlayerView` sale siempre de `projectFor` y nunca incluye información que el jugador no pueda conocer. Ver `docs/game-design.md`.

## Códigos de error

`INVALID_PAYLOAD`, `NOT_IN_GAME`, `NOT_ALLOWED`, `INVALID_TARGET`, `DUPLICATE_TARGET`, `POTION_USED`, `RATE_LIMITED`, `ROOM_NOT_FOUND`, `ROOM_FULL`, `NAME_TAKEN`, `ALREADY_IN_ROOM`, `NOT_IN_ROOM`, `TOO_MANY_ATTEMPTS`, `GAME_IN_PROGRESS`, `NOT_ENOUGH_PLAYERS`, `INVALID_CONFIG`, `SESSION_NOT_FOUND`, `INTERNAL`.
