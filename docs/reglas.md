# Howls in the Dark: las normas del juego

Este documento explica cómo funciona el juego tal y como está programado, en lenguaje de jugador. Si algo de aquí no te convence, es el sitio para revisarlo: cada regla corresponde a algo que hace el motor del juego (`packages/game-engine`).

---

## 1. La idea

Un pueblo, unos cuantos vecinos y, escondidos entre ellos, los lobos. Cada jugador recibe una **carta secreta** que dice quién es. De noche, los lobos se comen a alguien. De día, el pueblo debate y vota a quién expulsar. Gana el bando que consiga su objetivo.

- Se juega de **5 a 20 personas**, cada una desde su móvil u ordenador.
- **Nadie hace de narrador:** la propia partida cuenta lo que pasa.
- **El servidor decide todo.** Tu pantalla solo muestra lo que tú puedes saber; no hay forma de "mirar" las cartas de los demás.

## 2. La mesa

- Los jugadores se sientan en **círculo**, en el orden en que entraron en la sala. El primero está **arriba** y los demás siguen en el **sentido de las agujas del reloj**.
- **Todos ven la misma mesa**, colocada igual: no gira para ponerte a ti delante.
- "**Tu izquierda**" es el siguiente jugador en el sentido de las agujas del reloj (como si estuvierais sentados alrededor de una mesa de verdad). Importa para el Zorro, el Caballero y el Domador de osos.
- Los **muertos** se quedan en su sitio, en gris y con un **zarpazo rojo**. Si tocas a un muerto ves su carta (si se reveló al morir).

## 3. Cómo transcurre una partida

```
(Día 0: solo si hay Ángel en la baraja)
Noche 1 → Amanecer → Día 1 → Noche 2 → Amanecer → Día 2 → …
```

### La noche

Los personajes con poderes nocturnos "se despiertan" **por turnos y siempre en este orden**:

| # | Turno | ¿Cuándo? |
|---|---|---|
| 1 | Cupido | Solo la primera noche |
| 2 | Vidente | Todas las noches |
| 3 | Niño salvaje | Solo la primera noche |
| 4 | Perro lobo | Solo la primera noche |
| 5 | Salvador | Todas las noches |
| 6 | Lobos (toda la manada) | Todas las noches |
| 7 | Padre de los lobos | Todas las noches |
| 8 | Gran lobo feroz | Todas las noches |
| 9 | Lobo blanco | Noches pares (2, 4, 6…) |
| 10 | Bruja | Todas las noches |
| 11 | Zorro | Todas las noches |
| 12 | Flautista | Todas las noches |

- Solo hay turno para los personajes que están **en la baraja** de esta partida.
- **Cada turno dura siempre lo mismo** (30 s en ritmo normal), **aunque ese personaje ya esté muerto** y aunque haya actuado en 2 segundos. Así nadie puede deducir quién vive o quién ha actuado por lo que tarda la noche.
- Mientras dura tu turno puedes **cambiar de idea** cuantas veces quieras. Si pulsas **Pasar**, se anula lo que hubieras elegido.
- Si no haces nada, cuenta como que no usas tu poder (salvo el Niño salvaje y el Perro lobo, que ver en sus fichas).

### El amanecer

- Se anuncian **todas las muertes de la noche juntas**, sin decir quién mató a quién (lobos, bruja, lobo blanco… todo se anuncia igual: "aparece sin vida").
- Según el ajuste del anfitrión, al morir se enseña **la carta**, **solo el bando** o **nada**.
- Si alguien tiene que reaccionar a su muerte (Cazador, Alguacil), se hace ahora.

### El día

1. **Elección del Alguacil** (solo el primer día, si el anfitrión lo activó).
2. **Debate** (3 min en ritmo normal). Los vivos hablan en el chat de la aldea. Cada uno puede pulsar **"Listo para votar"**; si **todos los vivos** lo pulsan, el debate termina antes de tiempo.
3. **Votación** (1 min). Cada vivo vota a otro jugador o se abstiene.
   - **No puedes votarte a ti mismo** (salvo en la elección de Alguacil).
   - **El voto es secreto hasta el cierre:** mientras se vota, cada uno ve solo su propio voto y **quién ha votado ya** (no a quién). Al cerrarse, se revelan todas las papeletas a la vez y el narrador cuenta quién votó a quién.
   - Puedes cambiar el voto hasta que acabe el tiempo. Si **todos los vivos han votado** (o se han abstenido), la votación se cierra sola.
   - Expulsan al más votado, en ese mismo momento. El voto del Alguacil vale **doble**.
4. Después, si nadie ha ganado, cae la noche.

### Empates en la votación (lo elige el anfitrión)

- **Segunda vuelta** (por defecto): se vota otra vez solo entre los empatados. Si vuelve a haber empate, no muere nadie.
- **Nadie muere**: con empate no se expulsa a nadie.
- **Decide el Alguacil**: el Alguacil elige a quién expulsar entre los empatados (o a nadie). Si no hay Alguacil vivo, se hace segunda vuelta.

### El Alguacil

- Se elige el primer día por mayoría. Si hay empate, se decide al azar.
- Su voto **cuenta doble**.
- La elección de Alguacil **no expulsa a nadie**. Si muere, **nombra sucesor** entre los vivos. Si no lo hace a tiempo, se elige uno al azar. Si con su muerte la partida ya ha terminado, no se nombra a nadie.

## 4. Los personajes

### 🐺 La manada (los lobos)

Los lobos **se conocen entre sí** (ven una huella roja en sus compañeros) y tienen **un chat propio** en el que solo pueden escribir **de noche**.

| Personaje | Qué hace |
|---|---|
| **Lobo** | Cada noche vota con la manada a quién comerse. Muere el más votado; si hay empate, se decide al azar; si nadie vota, no muere nadie. No pueden elegir a otro miembro de la manada. |
| **Padre de los lobos** | Es un lobo más. **Una vez por partida** puede **infectar** a la víctima en vez de matarla: esa persona no muere, se pasa a la manada en secreto y **conserva su carta y sus poderes** (una vidente infectada sigue viendo cartas, pero ahora trabaja para los lobos). La poción de vida de la bruja no deshace la infección. Si la víctima es el Anciano, la infección no funciona: el ataque sigue como uno normal y el poder se gasta. Si el Salvador protegía a la víctima, no hay infección y el poder **no** se gasta. |
| **Gran lobo feroz** | Es un lobo más. **Mientras no haya muerto ningún miembro de la manada**, cada noche mata a una **segunda víctima** (que no sea lobo ni la víctima de la manada). |

### 🏡 El pueblo

| Personaje | Qué hace |
|---|---|
| **Aldeano** | No tiene poder. Su arma es el debate y el voto. |
| **Vidente** | Cada noche ve la **carta** de un jugador. Una persona infectada sigue mostrando su carta original. |
| **Bruja** | Juega **a ciegas**: no sabe a quién han atacado. Tiene **dos pociones de un solo uso**: una de **vida**, que protege a quien ella elija (ella incluida) de **cualquier ataque de lobos** esa noche (manada, Gran lobo feroz y Lobo blanco) y **se gasta aunque no ataquen a esa persona**; y una de **muerte**, que mata a cualquier jugador vivo. Puede usar las dos la misma noche, pero **no sobre la misma persona**. |
| **Cazador** | Cuando muere, **por cualquier causa**, puede **disparar** a otro jugador y llevárselo con él. Puede no disparar. Al apuntar, todos sabrán que era el cazador. |
| **Cupido** | La primera noche **enamora a dos jugadores** (puede elegirse a sí mismo). Los enamorados se conocen y tienen un **chat privado**. Si uno muere, el otro **muere de pena**. Si son de bandos distintos, abandonan su bando: solo ganan si son **los dos últimos vivos**. Si Cupido no elige, no hay pareja. |
| **Hermanas** (siempre van las dos) | Se conocen desde el principio: cada una ve la carta de la otra. |
| **Zorro** | Cada noche puede señalar a un jugador y sabe si **hay algún lobo entre esa persona y sus dos vecinos vivos**. Si **no hay ninguno**, el zorro **pierde el olfato** para siempre. Es opcional cada noche. |
| **Salvador** | Cada noche **protege a un jugador** (puede ser él mismo) del ataque de la manada y del Gran lobo feroz, y de la infección. **No puede proteger a la misma persona dos noches seguidas** (si una noche no protege a nadie, la restricción se reinicia). No protege del veneno, del Lobo blanco ni de las muertes de día. |
| **Caballero de la espada oxidada** | Si lo mata **la manada**, el primer lobo vivo **a su izquierda** se contagia y **muere al amanecer siguiente** (se anuncia como "herida oxidada"). |
| **Anciano** | **Resiste el primer ataque** de los lobos (no muere, solo él se entera). Pero si lo mata **el propio pueblo** (votación, veneno de la bruja o disparo del cazador), **todos los aldeanos pierden sus poderes** para el resto de la partida: Vidente, Bruja, Cazador, Zorro, Salvador, Caballero y Domador. |
| **Domador de osos** | Cada mañana, si alguno de sus **dos vecinos vivos** es un lobo, **el oso gruñe** y todo el pueblo lo oye (no dice cuál de los dos). Si el domador está infectado, el oso gruñe siempre. |

### 🌗 Ambiguos (empiezan en el pueblo, pueden acabar con los lobos)

| Personaje | Qué hace |
|---|---|
| **Niño salvaje** | La primera noche elige a un **modelo** (si no elige, se le asigna uno al azar). Si su modelo muere, en cualquier momento, el niño **se pasa a la manada**. |
| **Perro lobo** | La primera noche elige bando: **pueblo** o **manada**. Si elige manada, caza con los lobos esa misma noche. Si no elige, se queda en el pueblo. |

### 🎭 Solitarios (juegan para sí mismos)

| Personaje | Qué hace |
|---|---|
| **Lobo blanco** *(solo con 8 jugadores o más)* | Caza con la manada y los lobos creen que es uno de ellos, pero juega solo: **las noches pares puede matar a un lobo**. Gana si es **el último vivo**. Mientras viva, la manada no puede ganar. |
| **Flautista** *(solo con 9 jugadores o más)* | Cada noche **encanta a uno o dos jugadores** nuevos (nunca a sí mismo). Los encantados saben quién más está encantado. Gana si **todos los demás vivos están encantados**. Si lo infectan, pierde su poder y su objetivo. |
| **Ángel** | Con el Ángel en la baraja, la partida **empieza de día** (Día 0: elección de Alguacil si está activada, debate y votación). El Ángel **gana al instante si muere en el primer turno**: expulsado en el Día 0 o muerto la primera noche por los lobos o por la bruja. Después es un aldeano normal. Si está enamorado, renuncia a su objetivo. |

### ❌ Personaje retirado

- **Niña**: en la mesa espía a los lobos con los ojos entreabiertos y se arriesga a que la pillen. Online no hay forma justa de hacerlo: la versión digital leía todo el chat de la manada y le daba al pueblo el plan completo de los lobos. Se ha quitado del juego.

### ¿Por qué el Flautista y el Lobo blanco piden mesas grandes?

Se simularon miles de partidas con el motor real. En mesas pequeñas el **Flautista ganaba antes de que el pueblo hubiera podido debatir** (hacia la 2.ª noche) y el **Lobo blanco dejaba a la manada casi sin opciones** (los lobos ganaban solo un 6-9 % de las veces). Con 9 jugadores (Flautista) y 8 (Lobo blanco) los tres bandos ganan al menos 1 de cada 5 partidas y el solitario no gana antes que los demás. Detalle en `docs/decisions/0007-roles-online.md`.

## 5. Cómo se gana

Se comprueba cada vez que se resuelven las muertes (y las reacciones), en este orden:

1. **Ángel**: si muere en el primer turno, gana él solo y la partida acaba.
2. **No queda nadie vivo**: no gana nadie.
3. **Pareja de bandos distintos**: si son los dos últimos vivos, ganan los enamorados.
4. **Flautista**: si está vivo y todos los demás vivos están encantados.
5. **Lobo blanco**: si es el único vivo.
6. **Pueblo**: si no queda ningún miembro de la manada vivo. Ganan todos los del pueblo (también los muertos), menos el Flautista y la pareja mixta.
7. **Lobos**: si todos los vivos son de la manada y el Lobo blanco no está entre ellos. Ganan todos los de la manada (también los muertos y los infectados), menos el Lobo blanco y la pareja mixta.

Por seguridad, si se llega al **día 40** sin ganador, la partida termina sin ganador.

## 6. Qué ve cada uno

| Quién | Qué sabe |
|---|---|
| **Todos** | Su propia carta, quién está vivo, quién es Alguacil, quién ha votado ya (y, al cerrarse cada votación, todas las papeletas), las muertes (con lo que se revele), los gruñidos del oso y lo que cuenta el narrador. |
| **Los lobos** | Quién más es de la manada y los votos de la manada durante su turno. |
| **Los enamorados y Cupido** | Quiénes son los enamorados (corazón). |
| **El Flautista y los encantados** | Quién está encantado (destellos). |
| **La Vidente** | Las cartas que ha visto. |
| **Las Hermanas** | La carta de la otra hermana. |
| **Los muertos** | **Todo**: todas las cartas, todos los secretos, los votos en directo, y pueden leer los chats de la manada y de los enamorados. A cambio, ya no pueden hablar con los vivos. |
| **Al terminar** | Todos ven todas las cartas y todos los chats. |

**Lo que nadie ve:** a quién ha mirado la vidente, a quién protege el salvador, qué ha hecho la bruja, etc. Tampoco se puede deducir por tiempos: los turnos de noche duran siempre lo mismo y el servidor no manda nada a quien no le toca.

### El narrador

- Cuenta en voz de narrador todo lo público: la noche, quién despierta, el amanecer, las muertes, las votaciones…
- A cada uno le cuenta **en segunda persona** sus secretos ("Tu visión: Ana es Lobo").
- Los muertos, que lo ven todo, lo oyen **como testigos** ("La vidente, Luis, descubre que Ana es Lobo").

## 7. Los chats

| Chat | Quién lo lee | Quién escribe |
|---|---|---|
| **Aldea** | Todos (vivos y muertos) | Los vivos, **solo de día** (y durante las reacciones del cazador o el alguacil) |
| **Manada** | La manada viva; los muertos | La manada viva, **solo de noche** |
| **Pareja** | Los dos enamorados vivos; los muertos | Los dos enamorados vivos, en cualquier momento |
| **Muertos** | Solo los muertos | Los muertos |

Antes y después de la partida solo existe el chat de la sala, para todos.

## 8. Lo que elige el anfitrión

- **Baraja**: la recomendada para el número de jugadores o una personalizada. La recomendada lleva un lobo por cada 4 jugadores y después, por este orden, Vidente, Bruja, Cazador, Cupido, Salvador, Anciano y Zorro (dejando siempre al menos un aldeano).
- **Reglas de una baraja válida**: una carta por jugador, al menos un lobo, menos lobos que el resto, las hermanas van siempre por parejas, como mucho una copia de cada personaje especial, y los mínimos de jugadores del Lobo blanco (8) y el Flautista (9).
- **Ritmo**:

  | Ritmo | Turno de noche | Debate | Votación | Elección de Alguacil | Reacciones |
  |---|---|---|---|---|---|
  | Rápido | 20 s | 2 min | 45 s | 60 s | 20 s |
  | Normal | 30 s | 3 min | 60 s | 90 s | 30 s |
  | Pausado | 45 s | 5 min | 90 s | 2 min | 45 s |

- **Alguacil**: sí o no.
- **Al morir se revela**: la carta, solo el bando o nada.
- **Empates**: segunda vuelta, nadie muere o decide el Alguacil.

## 9. Casos raros

- **Bruja y Salvador salvan a la misma persona**: sigue viva (no se anulan entre sí).
- **La Bruja protege a alguien a quien nadie ataca**: la poción de vida se gasta igual (no sabe quién es la víctima).
- **La Bruja protege a alguien que el Lobo blanco ataca**: sobrevive (la poción frena cualquier ataque de lobos; el Salvador, en cambio, no frena al Lobo blanco).
- **Los lobos atacan al Anciano protegido por el Salvador**: no muere y **no** gasta su vida extra.
- **El Cazador es además Alguacil**: primero dispara y después nombra sucesor.
- **El Cazador mata a un enamorado**: su pareja muere de pena en ese momento.
- **El modelo del Niño salvaje muere de día**: el niño se pasa a la manada ya y caza con ella la noche siguiente.
- **Infectan al Domador de osos**: su oso gruñe todas las mañanas.
- **Infectan al Flautista**: deja de encantar y ya no puede ganar.
- **El Ángel está enamorado**: no gana por morir pronto; juega con su pareja.
- **La última muerte acaba la partida y el muerto era Alguacil**: no hay que esperar a que nombre sucesor.

## 10. Decisiones que quizá quieras revisar

Son reglas que funcionan así a propósito, pero que tienen alternativas razonables:

1. **El pueblo gana aunque el Flautista siga vivo**, si ya no quedan lobos.
2. **La Bruja juega a ciegas.** En el juego de mesa ve a la víctima; aquí elige a quién proteger sin saberlo, y su poción frena también al Lobo blanco.
3. **Los enamorados tienen chat privado a todas horas.** Es una ayuda grande, sobre todo para una pareja mixta.
4. **La manada solo puede hablar de noche.** De día tiene que disimular en el chat de la aldea como todos.
5. **Las Hermanas se conocen pero no tienen chat propio.**
6. **Los empates de la manada y de la elección de Alguacil se deciden al azar.**
7. **El Cazador queda revelado al apuntar**, aunque la partida esté configurada para no revelar cartas.
8. **Los muertos lo ven todo** (no es configurable desde la sala).
9. **La noche no se acelera nunca**: es más lenta, pero es lo que impide adivinar quién vive por los tiempos.
