# ADR 0003: Reconexión con `sessionToken` y política de desconexión

- **Estado:** aceptada
- **Fecha:** 2026-10-13
- **Desarrolla:** PLAN.md §4.3 (reconexión) · HID-5

## Contexto

Desde el móvil las conexiones se pierden a menudo (cambio de red, pantalla apagada, pestaña en segundo plano). Perder el asiento en cada corte arruinaría las partidas. El plan prevé un `sessionToken` en `localStorage` y una gracia de asiento, con una política si el jugador no vuelve.

## Decisión

1. **Token:** `room:create` y `room:join` devuelven un `sessionToken` (32 bytes aleatorios, base64url). El servidor solo guarda su **hash SHA-256**. Un socket nuevo recupera su asiento con `session:resume { token }`.
2. **Identidad = asiento, no socket.** Un jugador puede tener varias conexiones (varias pestañas o dispositivos): está *offline* solo cuando se cierra la última.
3. **Política de desconexión, según dónde esté el jugador:**
   - **Lobby:** el asiento se conserva `RECONNECT_GRACE_SECONDS` (60 por defecto, configurable) y se marca `connected: false` para los demás. Si no vuelve, se libera como si hubiera salido (con traspaso de host si hacía falta).
   - **Partida en curso:** el asiento se conserva **mientras dure la partida**; la gracia no aplica. El motor ya trata la falta de acción como "sin acción" al vencer el temporizador de la fase, así que la partida sigue y el jugador puede volver cuando quiera.
4. **Salir a propósito** (`room:leave`) libera el asiento al instante y revoca el token: no hay gracia.
5. Al reconectar en partida, el servidor envía el `game:view` actual del jugador (proyección con `projectFor`, nunca estado completo).

## Consecuencias

- **Los tokens viven en memoria** del proceso. Las partidas sí sobreviven a un despliegue (snapshots en Redis, ADR 0002), pero los jugadores **no podrán reanudar** su asiento tras reiniciar el servidor hasta que los tokens se guarden también en Redis. Es la siguiente mejora lógica; encaja con la restricción de una sola réplica.
- **Sin eliminación por abandono:** un jugador que desaparece en mitad de la partida se queda como asiento inactivo. Expulsarlo o matarlo exigiría una causa nueva en el motor (`kill`) y reglas de victoria; se deja para cuando haga falta.
- **Presencia solo en el lobby:** `connected` va en `room:state`; en partida los demás jugadores aún no ven quién está desconectado.
- **Salas inactivas:** el barrido de salas revoca también las sesiones.
