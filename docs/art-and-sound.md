# Arte y sonido

## Audio

Reproducción con [Howler.js](https://howlerjs.com/) (`apps/web/src/audio`). El navegador bloquea el audio hasta el primer gesto del usuario; Howler lo difiere solo, así que el resto del código puede llamarlo en cualquier momento.

- `catalog.ts`: qué pista suena en cada fase y qué efecto dispara cada evento (funciones puras, con tests).
- `audioManager.ts`: bucles con fundido cruzado, efectos puntuales y silencio persistente (`localStorage`).
- `AudioToggle`: botón de silencio accesible (`aria-pressed`).
- Integración con la partida: la pantalla de juego (HID-10) debe llamar a `audioManager.setPhase(view.phase)` al recibir `game:sync` y a `audioManager.handleEvents(events)` con los eventos de `game:events`; al salir de la partida, `audioManager.stop()`.

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

Los `.wav` son provisionales de calidad "boceto": pueden sustituirse por grabaciones/composiciones con licencia compatible sin tocar código (mismo nombre de archivo, o cambiando `catalog.ts`).
