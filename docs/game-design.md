# Diseño del juego

Especificación de las reglas que implementa `packages/game-engine`. Basado en la edición "Best Of" del juego de mesa (mecánicas; nombres y textos propios). Si una regla cambia aquí, cambia también en el motor y en sus tests.

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
| Lobo blanco | Forma parte de la manada, pero en las noches pares puede matar a otro lobo. Solo gana si es el último superviviente. Mientras esté vivo entre lobos, la manada no gana. |

### Aldeanos

| Rol | Regla implementada |
|---|---|
| Aldeano | Sin poder. |
| Vidente | Cada noche ve la **carta** de un jugador. Un infectado sigue mostrando su carta original. |
| Bruja | Una poción de vida (solo para las víctimas de lobos de esa noche, incluida ella) y una de muerte (cualquier jugador vivo). Puede usar las dos en la misma noche. |
| Cazador | Al morir, por cualquier causa, dispara a otro jugador (reacción). Puede no disparar. |
| Cupido | La noche 1 enamora a dos jugadores (puede incluirse). Si uno muere, el otro muere de pena. Si son de bandos distintos, solo ganan juntos siendo los dos últimos supervivientes. |
| Niña | Adaptación digital: lee el chat de los lobos de forma **anónima** (`canSpyWolves`) mientras conserve su poder. Ver canales en `docs/protocol.md`. |
| Hermanas (2) | Se conocen entre sí desde el inicio. Podrán tener un canal de chat propio. |
| Zorro | Señala a un jugador y sabe si hay algún lobo entre él y sus vecinos vivos más cercanos. Si no hay ninguno, pierde el poder para siempre. Es opcional cada noche. |
| Salvador | Cada noche protege a un jugador (él mismo incluido), que sobrevive al ataque de la manada y del Gran lobo feroz y no puede ser infectado esa noche (el poder del Padre no se gasta). No puede proteger al mismo jugador dos noches seguidas; si no protege a nadie, la restricción se reinicia. No frena veneno, Lobo blanco ni muertes de día. Si la Bruja cura a la misma víctima, sigue viva (no se anulan). |
| Caballero de la espada oxidada | Si lo matan los lobos de la manada, el primer lobo vivo a su izquierda muere en el siguiente amanecer (causa pública "óxido"). |
| Anciano | Resiste el primer ataque de lobos. Si lo mata el pueblo (voto, veneno o disparo), los aldeanos pierden sus poderes: Vidente, Bruja, Cazador, Niña, Zorro, Salvador, Caballero y Domador. |
| Domador de osos | Cada mañana el oso gruñe (evento público) si uno de sus vecinos vivos es lobo. Si el domador está infectado, gruñe siempre. |

### Ambiguos

| Rol | Regla implementada |
|---|---|
| Niño salvaje | La noche 1 elige un modelo (si no elige, se asigna uno al azar). Si el modelo muere, pasa a la manada desde la noche siguiente. |
| Perro lobo | La noche 1 elige bando. Si no elige, queda en el pueblo. Si elige lobos, se une a la manada esa misma noche. |

### Solitarios

| Rol | Regla implementada |
|---|---|
| Flautista | Cada noche encanta a hasta dos jugadores nuevos (no a sí mismo). Gana si todos los demás vivos están encantados. Si lo infectan, pierde su objetivo y su poder. |
| Ángel | La partida empieza con un día de votación. Gana al instante si muere en el primer turno: votado el día 0, o muerto por lobos o veneno la noche 1. Después es un aldeano normal. Si está enamorado, renuncia a su objetivo. |

### Alguacil

- **Elección:** se elige por mayoría simple el primer día (si `sheriff` está activo). Los empates se deciden con el RNG.
- **Voto:** cuenta doble.
- **Muerte:** al morir nombra sucesor (reacción). Si no lo hace a tiempo, se elige al azar.

## Votaciones

- **Votos:** cada vivo vota a otro jugador o se abstiene. Puede cambiar el voto hasta el cierre. Los votos son públicos.
- **Empate**, según `voteTieRule`:
  - `runoff` (por defecto): nueva votación entre los empatados. Si vuelve a haber empate, no muere nadie.
  - `no-elimination`: no muere nadie.
  - `sheriff`: decide el Alguacil. Si no hay Alguacil, se aplica `runoff`.
- **Cierre anticipado:** el día puede cerrarse antes si todos los vivos han votado.

## Muertes y revelación

- **Causas públicas:** las muertes nocturnas se anuncian todas como "noche", sin decir quién mató a quién. Las de día se anuncian como "voto", "cazador", "pena" (enamorados) u "óxido".
- **`revealOnDeath`:** se revela el rol (por defecto), solo el bando o nada.
- **`deadSeeEverything`:** los muertos ven todos los roles y eventos (por defecto, sí).

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
- **Funciones puras:** cada función trabaja sobre una copia profunda. El estado es JSON serializable, apto para Redis o Postgres.
- **Aleatoriedad:** solo a través del RNG con semilla guardado en el estado. Las partidas son reproducibles.
- **Acciones:** `applyAction` solo registra la intención (se puede cambiar de idea). Los efectos se aplican al cerrar el paso.
- **Validación:** `pendingActionFor` decide qué puede hacer cada jugador. Valida las acciones y alimenta la vista, así que nunca discrepan.
- **Añadir un rol:**
  1. Añadirlo a `ROLES` (`shared`).
  2. Si tiene paso nocturno, añadirlo a `NIGHT_STEPS`, `nightSteps` y `finishNightStep`.
  3. Añadir sus acciones a `pendingActionFor` y a `applyAction`.
  4. Escribir sus tests.
