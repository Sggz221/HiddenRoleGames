# ADR 0005: El narrador es la partida, con textos predefinidos

- **Estado:** aceptada
- **Fecha:** 2026-10-13
- **Desarrolla:** PLAN.md §3.3 (modo narrador automático) · HID-21

## Contexto

En el juego de mesa una persona narra: anuncia la noche, despierta a cada rol, cuenta quién ha muerto. Aquí nadie debe quedarse fuera para hacerlo. El motor ya emite eventos (`game:events`), pero no hay texto: cada cliente tendría que reconstruir la historia y era fácil que dos clientes lo contaran distinto o que se colara un dato secreto.

## Decisión

1. **El motor narra.** `narrate(state, events)` (pura, en `packages/game-engine`) convierte un lote de eventos en `NarrationLine[]`, cada una con una clave de texto y sus datos. Elige la variante: cuántas muertes al amanecer, causa de cada muerte y cuánto se revela (`role`/`side`/`hidden`), empate o expulsión, equipo ganador.
2. **Solo con lo que el jugador recibió.** El servidor llama a `narrate` con la salida de `eventsFor`, así la narración no puede revelar más que los propios eventos. El test de propiedades lo comprueba en partidas aleatorias.
3. **Nuevo evento `dawn`.** Marca el fin de la noche, para poder narrar "no ha muerto nadie" y contar las víctimas del lote.
4. **Textos en i18n del cliente.** Las claves están en `NARRATION_KEYS` (`packages/shared`). Los textos están en `narration.*` de `es.json`, como el resto de textos de usuario (regla 8). El cliente solo rellena los huecos (`narrationText`). Un test exige un texto por clave y que no quede ningún `{{hueco}}` sin rellenar.
5. **Nuevo mensaje `game:narration`** por jugador, junto a `game:events`. Los eventos siguen existiendo para animaciones y sonido.

## Consecuencias

- Añadir un evento obliga a narrarlo (o a ignorarlo a propósito): el `switch` de `narrate` es exhaustivo y no compila si falta un caso.
- Añadir una clave obliga a escribir su texto: el test de la web falla si falta.
- Otro idioma solo necesita otro JSON con las mismas claves.
- El modo narrador humano (v2, PLAN.md §3.3) queda fuera. Si llega, será otra fuente de líneas, no un cambio del motor.
