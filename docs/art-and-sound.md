# Arte y sonido

## Audio

Reproducción con [Howler.js](https://howlerjs.com/) (`apps/web/src/audio`). El navegador bloquea el audio hasta el primer gesto del usuario; Howler lo difiere solo, así que el resto del código puede llamarlo en cualquier momento.

- `catalog.ts`: qué pista suena en cada fase y qué efecto dispara cada evento (funciones puras, con tests).
- `audioManager.ts`: bucles con fundido cruzado y efectos puntuales. Música y efectos se silencian por separado y la elección se guarda en `localStorage`.
- `AudioToggle` (lobby): silencia todo. En la partida, la barra superior tiene un botón para efectos y otro para música.
- Integración con la partida: `net/client.ts` pasa los `game:events` a `audioManager.handleEvents`; la pantalla de juego sigue la fase con `setPhase`, hace sonar el latido y el tic del contador, el giro de la carta, los desplegables, la selección, el chat y el cierre de victoria o derrota.

## Tipografías

- **Bricolage Grotesque** (texto) y **Grenze Gotisch** (la manada): SIL Open Font License 1.1, empaquetadas desde npm (`@fontsource-variable/bricolage-grotesque`, `@fontsource/grenze-gotisch`). Se sirven desde nuestro propio dominio, sin peticiones a Google.
- Títulos: Georgia (sistema).

## Ilustración

Todo el arte visual es **SVG propio dibujado en código**, sin imágenes de terceros.

- **Paisaje de la partida** (`apps/web/src/animations/Landscape.tsx`): cordillera con bosque lejano, bosque cercano, prado con hierba, caminos de tierra, casa de entramado con tejado de paja y leñera, un roble y una fogata con asientos de tronco. Los colores salen del reloj de la partida (`daytime.ts`: `paletteAt` calcula la luz del día y el color de cada parte de la escena, que `useGameClock` escribe como variables `--sc-*`). La casa se mantiene clara frente al suelo a cualquier hora (lo comprueban los tests). La fogata arde del anochecer al alba y por la mañana está apagada y humea. Las llamas, chispas y humo solo se animan sin `prefers-reduced-motion`.
- **Avatares** (`apps/web/src/components/avatar/`): retrato de aldeano por jugador con tono de piel, género, peinado, color de pelo, vello facial y ropa de pueblo (túnica, jubón de cuero, blusón, vestido con delantal, corpiño, mantón o capucha) en tintes naturales. Se deriva del id del jugador; ver [ADR 0006](decisions/0006-avatares-derivados-del-id.md).

## Registro de assets

Todos los sonidos son **originales**: los genera `scripts/generate-audio.mjs` (síntesis con ondas y ruido determinista, sin muestras de terceros) y se escriben en `apps/web/public/audio/`. Para regenerarlos: `node scripts/generate-audio.mjs`.

Licencia de todos los assets: **CC0 1.0** (dominio público). Si se añade un asset externo, registrarlo aquí con autor, URL y licencia **antes** de hacer commit.

| Archivo | Uso | Origen | Licencia |
|---|---|---|---|
| `ambient-night.wav` | Bucle de las fases de noche | `generate-audio.mjs` | CC0 |
| `ambient-day.wav` | Bucle de debate y elección de alguacil | `generate-audio.mjs` | CC0 |
| `ambient-vote.wav` | Bucle de votación, desempate y reacciones | `generate-audio.mjs` | CC0 |
| `howl.wav` | Aullido al empezar la noche | `generate-audio.mjs` | CC0 |
| `death.wav` | Anuncio de una muerte | `generate-audio.mjs` | CC0 |
| `dawn.wav` | Amanecer | `generate-audio.mjs` | CC0 |
| `vote-cast.wav` | Voto emitido | `generate-audio.mjs` | CC0 |
| `heartbeat.wav` | Latido en los últimos 10 s de una fase | `generate-audio.mjs` | CC0 |
| `tick.wav` | Tic de reloj en los últimos 5 s | `generate-audio.mjs` | CC0 |
| `bell.wav` | Campana al anunciar las muertes de la noche | `generate-audio.mjs` | CC0 |
| `growl.wav` | Gruñido cuando despierta la manada | `generate-audio.mjs` | CC0 |
| `card-flip.wav` | Girar la carta de rol | `generate-audio.mjs` | CC0 |
| `stinger-win.wav` | Fin de partida: tu bando gana | `generate-audio.mjs` | CC0 |
| `stinger-lose.wav` | Fin de partida: tu bando pierde | `generate-audio.mjs` | CC0 |
| `ui-open.wav` / `ui-close.wav` | Abrir y cerrar desplegables | `generate-audio.mjs` | CC0 |
| `select.wav` | Elegir a un jugador | `generate-audio.mjs` | CC0 |
| `chat-pop.wav` | Llega un mensaje de chat | `generate-audio.mjs` | CC0 |

Los `.wav` son provisionales de calidad "boceto": pueden sustituirse por grabaciones/composiciones con licencia compatible sin tocar código (mismo nombre de archivo, o cambiando `catalog.ts`).
