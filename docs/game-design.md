# Diseño del juego

Especificación de las reglas que implementa `packages/game-engine` (versión para jugadores: [`reglas.md`](reglas.md)). Basado en la edición "Best Of" del juego de mesa (mecánicas; nombres y textos propios). Si una regla cambia aquí, cambia también en el motor y en sus tests.

## Ciclo de partida

```
[Día 0: debate → votación]   ← solo si el Ángel está en la baraja
Noche N: pasos de roles en orden fijo
Amanecer: se resuelven las muertes (+ reacciones)
Día N: [elección de Alguacil, solo el primer día] → debate → votación → [desempate]
  → reacciones → comprobar victoria → Noche N+1
```

- **Asientos:** el orden de `players` es el orden en la mesa. "Izquierda" = siguiente asiento.
- **Reacciones:** decisiones que interrumpen el flujo hasta resolverse o agotar su tiempo (disparo del Cazador, sucesor del Alguacil, desempate del Alguacil).
- **Victoria:** se comprueba cuando no quedan reacciones pendientes.
- **Límite de seguridad:** `maxDays`. Al alcanzarlo, la partida termina sin ganador.

## Orden de la noche

| # | Paso | Cuándo |
|---|---|---|
| 1 | Cupido | Solo noche 1 |
| 2 | Vidente | Todas |
| 3 | Niño salvaje | Solo noche 1 |
| 4 | Perro lobo | Solo noche 1 |
| 5 | Salvador | Todas |
| 6 | Lobos (manada) | Todas |
| 7 | Padre de los lobos (infección) | Todas |
| 8 | Gran lobo feroz | Todas |
| 9 | Lobo blanco | Noches pares |
| 10 | Bruja | Todas |
| 11 | Zorro | Todas |
| 12 | Flautista | Todas |

**Regla anti-filtración:** un paso existe si su rol está en la baraja, **esté vivo o no**, y dura siempre `nightStepSeconds`. La noche nunca termina antes de tiempo (`canAdvanceEarly` es siempre `false` de noche).

Los pasos de puro reconocimiento (enamorados, hermanas, encantados, domador de osos) no consumen tiempo: esa información llega por la vista de cada jugador.

## Roles

### Lobos

| Rol | Regla implementada |
|---|---|
| Lobo | Vota víctima con la manada. La víctima es la más votada; los empates se deciden con el RNG con semilla. No puede elegir a un miembro de la manada. |
| Padre de los lobos | Una vez por partida puede infectar a la víctima en lugar de matarla. El infectado pasa a la manada pero conserva su carta y sus poderes. La Bruja no puede curarlo. Si la víctima es el Anciano, la infección no surte efecto: el ataque sigue como uno normal y se gasta el poder. |
| Gran lobo feroz | Mientras no haya muerto ningún miembro de la manada, mata a una segunda víctima (que no sea lobo ni la víctima de la manada). |
| Lobo blanco | Solo con 8 jugadores o más (ADR 0006). Forma parte de la manada, pero en las noches pares puede matar a otro lobo. Solo gana si es el último superviviente. Mientras esté vivo entre lobos, la manada no gana. |

### Aldeanos

| Rol | Regla implementada |
|---|---|
| Aldeano | Sin poder. |
| Vidente | Cada noche ve la **carta** de un jugador. Un infectado sigue mostrando su carta original. |
| Bruja | Una poción de vida (solo para las víctimas de lobos de esa noche, incluida ella) y una de muerte (cualquier jugador vivo). Puede usar las dos en la misma noche. |
| Cazador | Al morir, por cualquier causa, dispara a otro jugador (reacción). Puede no disparar. |
| Cupido | La noche 1 enamora a dos jugadores (puede incluirse). Si uno muere, el otro muere de pena. Si son de bandos distintos, solo ganan juntos siendo los dos últimos supervivientes. |
| Hermanas (2) | Se conocen entre sí desde el inicio. Podrán tener un canal de chat propio. |
| Zorro | Señala a un jugador y sabe si hay algún lobo entre él y sus vecinos vivos más cercanos. Si no hay ninguno, pierde el poder para siempre. Es opcional cada noche. |
| Salvador | Cada noche protege a un jugador (él mismo incluido), que sobrevive al ataque de la manada y del Gran lobo feroz y no puede ser infectado esa noche (el poder del Padre no se gasta). No puede proteger al mismo jugador dos noches seguidas; si no protege a nadie, la restricción se reinicia. No frena veneno, Lobo blanco ni muertes de día. Si la Bruja cura a la misma víctima, sigue viva (no se anulan). |
| Caballero de la espada oxidada | Si lo matan los lobos de la manada, el primer lobo vivo a su izquierda muere en el siguiente amanecer (causa pública "óxido"). |
| Anciano | Resiste el primer ataque de lobos. Si lo mata el pueblo (voto, veneno o disparo), los aldeanos pierden sus poderes: Vidente, Bruja, Cazador, Zorro, Salvador, Caballero y Domador. |
| Domador de osos | Cada mañana el oso gruñe (evento público) si uno de sus vecinos vivos es lobo. Si el domador está infectado, gruñe siempre. |

### Ambiguos

| Rol | Regla implementada |
|---|---|
| Niño salvaje | La noche 1 elige un modelo (si no elige, se asigna uno al azar). Si el modelo muere, pasa a la manada desde la noche siguiente. |
| Perro lobo | La noche 1 elige bando. Si no elige, queda en el pueblo. Si elige lobos, se une a la manada esa misma noche. |

### Solitarios

| Rol | Regla implementada |
|---|---|
| Flautista | Solo con 9 jugadores o más (ADR 0006). Cada noche encanta a hasta dos jugadores nuevos (no a sí mismo). Gana si todos los demás vivos están encantados. Si lo infectan, pierde su objetivo y su poder. |
| Ángel | La partida empieza con un día de votación. Gana al instante si muere en el primer turno: votado el día 0, o muerto por lobos o veneno la noche 1. Después es un aldeano normal. Si está enamorado, renuncia a su objetivo. |

### Alguacil

- **Elección:** se elige por mayoría simple el primer día (si `sheriff` está activo). Los empates se deciden con el RNG.
- **Voto:** cuenta doble.
- **Muerte:** al morir nombra sucesor (reacción). Si no lo hace a tiempo, se elige al azar. Si con esa muerte la partida ya está decidida, no se nombra sucesor.

## Votaciones

- **Votos:** cada vivo vota a otro jugador o se abstiene. Puede cambiar el voto hasta el cierre. Los votos son públicos.
- **Empate**, según `voteTieRule`:
  - `runoff` (por defecto): nueva votación entre los empatados. Si vuelve a haber empate, no muere nadie.
  - `no-elimination`: no muere nadie.
  - `sheriff`: decide el Alguacil (el resultado se anuncia cuando decide; si no elige, no muere nadie). Si no hay Alguacil, se aplica `runoff`.
- **Cierre anticipado:** el día puede cerrarse antes si todos los vivos han votado.

## Muertes y revelación

- **Causas públicas:** las muertes nocturnas se anuncian todas como "noche", sin decir quién mató a quién. Las de día se anuncian como "voto", "cazador", "pena" (enamorados) u "óxido".
- **`revealOnDeath`:** se revela el rol (por defecto), solo el bando o nada.
- **`deadSeeEverything`:** los muertos ven todos los roles y eventos (por defecto, sí).

## Narrador

- **La partida narra, no un jugador.** Nadie se queda fuera para dirigir: el servidor narra cada lote de eventos con textos predefinidos (`narration.*` en `apps/web/src/i18n/locales/es.json`).
- **Qué se narra:** inicio y carta propia, caída de la noche, cada rol que despierta (aunque esté muerto, para no filtrar nada), amanecer (nadie, una o varias muertes), cada muerte según su causa y `revealOnDeath`, alguacil, debate, votación, empates y segunda vuelta, reacciones (cazador, sucesión, desempate), el oso, la pérdida de poderes y el final según el equipo ganador.
- **Líneas privadas:** visiones, elección de la manada, infección, zorro, flautista, enamorados, niño salvaje, perro lobo y anciano solo llegan a quien recibió el evento. Quien actuó las oye en segunda persona ("Tu visión..."); los muertos y, al final, todos los demás las oyen como testigos (`witness.*`: "La vidente, Ana, descubre..."). El infectado oye que se ha unido a la manada.
- **Sin narración:** los votos uno a uno (ya se ven en la interfaz).
- Lista completa de textos: `NARRATION_KEYS` en `packages/shared`. Los tests fallan si falta alguno. Ver ADR 0005.

## Condiciones de victoria (en este orden)

1. Ángel (instantánea al morir en el primer turno).
2. Nadie vivo → sin ganador.
3. Pareja mixta y son los dos últimos → enamorados.
4. Flautista vivo y todos los demás encantados → flautista.
5. Solo queda el Lobo blanco → lobo blanco.
6. Ningún miembro de la manada vivo → aldea (todos los del bando aldea salvo el Flautista y la pareja mixta).
7. Todos los vivos son de la manada y el Lobo blanco no está entre ellos → lobos.

## Arquitectura del motor

- **API:**
  - `createGame` y `applyAction`: crear la partida y registrar la intención de un jugador.
  - `advancePhase`, `canAdvanceEarly` y `phaseDurationSeconds`: control de fases y tiempos.
  - `projectFor` y `eventsFor`: lo que ve y recibe cada jugador.
  - `narrate`: lo que dice el narrador sobre los eventos que recibió un jugador.
- **Funciones puras:** cada función trabaja sobre una copia profunda. El estado es JSON serializable, apto para Redis o Postgres.
- **Aleatoriedad:** solo a través del RNG con semilla guardado en el estado. Las partidas son reproducibles.
- **Acciones:** `applyAction` solo registra la intención (se puede cambiar de idea; `skip` la retira). Los efectos se aplican al cerrar el paso. `choiceOf` devuelve la intención actual de cada jugador para su propia vista.
- **Validación:** `pendingActionFor` decide qué puede hacer cada jugador. Valida las acciones y alimenta la vista, así que nunca discrepan.
- **Añadir un rol:**
  1. Añadirlo a `ROLES` (`shared`).
  2. Si tiene paso nocturno, añadirlo a `NIGHT_STEPS`, `nightSteps` y `finishNightStep`.
  3. Añadir sus acciones a `pendingActionFor` y a `applyAction`.
  4. Escribir sus tests.
