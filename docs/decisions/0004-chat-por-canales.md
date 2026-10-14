# ADR 0004: Chat por canales con membresía decidida por el motor

- **Estado:** aceptada
- **Fecha:** 2026-10-13
- **Desarrolla:** PLAN.md §4.3 (canales de chat) · HID-6

## Contexto

El juego necesita hablar en grupo: todos de día, la manada de noche, los muertos entre sí y los enamorados en privado. Quién puede leer o escribir depende del estado secreto (bando, vida, enamorados, poder de la Niña, `deadSeeEverything`). Si el cliente lo decidiera, bastaría con abrir las herramientas del navegador para leer el canal de los lobos.

## Decisión

1. **Cuatro canales fijos:** `general`, `wolves`, `dead` y `lovers`. Tabla de permisos en `docs/protocol.md`.
2. **La membresía es una regla del juego, así que vive en el motor.** `chatAccessFor(state, player)` y `chatRecipients(state, channel)` son funciones puras de `packages/game-engine`. La misma función alimenta `view.chat` (lo que pinta el cliente) y la comprobación del servidor, para que nunca discrepen.
3. **`GameSession.chat` es el puente:** valida que el autor puede escribir, calcula los lectores con el estado actual y entrega un mensaje por jugador a su canal privado de Socket.IO. No pasa por la cola de acciones porque no cambia el estado.
4. **Anonimato por receptor:** cada lector recibe su propia copia. La Niña recibe las líneas de los lobos con `from` y `name` a `null`.
   *Actualización 2026-10-14:* la Niña se retiró del juego (ADR 0006), así que ya no hay lectores anónimos y `from`/`name` siempre van rellenos.
5. **Lobby:** antes y después de la partida solo hay `general`, difundido a la sala sin pasar por el motor.
6. **Protección básica:** esquema Zod (300 caracteres, sin caracteres de control ni marcas bidi) y un *token bucket* por socket (ráfaga de 5, 1 cada 2 s).

## Consecuencias

- **Sin historial:** los mensajes no se guardan en el snapshot ni en Postgres. Quien reconecta pierde lo dicho mientras estaba fuera. Si hace falta, se añadiría un búfer por canal en `GameSession` (no en el estado del motor, que debe seguir siendo pequeño).
- **Carreras inevitables:** si el estado cambia entre la vista del jugador y su mensaje (le disparan, acaba la partida), el servidor lo rechaza con `NOT_ALLOWED`. Es correcto; el cliente solo debe mostrarlo de forma discreta.
- **Límite por socket, no por jugador:** varias pestañas suman presupuesto. Suficiente contra el spam accidental; la moderación seria llega en el Hito 5 (HID-14).
- **Canal de hermanas:** no existe todavía. Añadirlo es una entrada más en `CHAT_CHANNELS` y una regla en `chatAccessFor`.
