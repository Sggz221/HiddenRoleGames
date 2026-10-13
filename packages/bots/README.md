# @howlsinthedark/bots

Clientes bot (`socket.io-client`) que juegan contra el servidor real, igual que el cliente web: solo leen `game:view` y responden a lo que ofrece `view.pending`.

- `Bot`: se conecta, crea o se une a una sala, arranca la partida (si es anfitrión), juega, chatea (`chat: true`) y puede caerse y volver con `drop()` / `resume()`.
  - `errors`: peticiones rechazadas y eventos `error` (deben quedar vacíos).
  - `staleChats`: mensajes rechazados porque el estado cambió entre la vista y el mensaje (no son errores de protocolo).
  - `chats`: mensajes recibidos junto con la vista que tenía el bot en ese momento.
- `chooseAction(view, rng)`: estrategia pura y reproducible con semilla. Los lobos no votan a sus aliados; el resto es aleatorio.

## Uso

Los tests de integración del servidor los usan con un reloj falso para jugar partidas enteras en segundos:

- `apps/server/src/realtime/full-game.test.ts`: partidas completas de 6-8 bots con chat y una reconexión a mitad de partida (HID-7).
- `apps/server/src/testing/realtime-harness.ts`: servidor de pruebas, `settle` y `playUntilEnd`.

Pendiente: prueba de carga con 200+ conexiones (HID-15).
