# ADR 0007: Roles que no encajan online: fuera la Niña, mínimo de jugadores para los solitarios

- **Estado:** aceptada
- **Fecha:** 2026-10-14
- **Desarrolla:** revisión de reglas y equilibrio antes de la beta

## Contexto

La baraja "Best Of" está pensada para una mesa física. Al revisarla para jugar online:

- **Niña:** en la mesa espía con los ojos entreabiertos y se arriesga a que la pillen. La adaptación digital (leer el chat de la manada de forma anónima, ADR 0004) no tiene ese riesgo y le da a la aldea el plan completo de los lobos cada noche. No hay forma justa de trasladar "mirar a escondidas" a una pantalla.
- **Flautista y Lobo blanco** funcionan online, pero en mesas pequeñas rompen el ritmo: el Flautista gana antes de que la aldea haya podido debatir y el Lobo blanco deja a la manada casi sin opciones.

## Decisión

1. **Se retira la Niña** del juego (`ROLE_IDS`, poderes de la aldea, mazo recomendado, chat anónimo). Su sitio en el mazo recomendado lo ocupa el Salvador.
2. **`RoleInfo.minPlayers`**: un rol puede exigir un mínimo de jugadores. `deckIssues` lo comprueba (`roleNeedsPlayers`), así que lo valida el lobby y lo vuelve a validar el servidor.
3. **Mínimos calculados por simulación** (`pnpm --filter @howlsinthedark/game-engine balance 1000 5-14`): el motor real con jugadores ingenuos (decisiones al azar; la manada nunca ataca a los suyos) sobre el mazo recomendado más el solitario. Mínimo = menor mesa en la que:
   - los tres bandos ganan al menos un 20 % de las partidas, y
   - el solitario no gana, de media, antes que la aldea o los lobos.

   | Jugadores | Flautista gana | su día medio | Aldea (día) | Lobos (día) |
   |---|---|---|---|---|
   | 7 | 18 % | 2,1 | 61 % (1,6) | 14 % (2,6) |
   | 8 | 25 % | 2,4 | 38 % (2,5) | 32 % (3,0) |
   | **9** | 25 % | 2,9 | 38 % (2,8) | 35 % (3,8) |
   | 10 | 26 % | 3,2 | 35 % (3,3) | 38 % (4,2) |

   | Jugadores | Lobo blanco gana | su día medio | Aldea (día) | Lobos (día) |
   |---|---|---|---|---|
   | 6 | 19 % | 2,0 | 51 % (1,8) | 9 % (1,9) |
   | 7 | 17 % | 2,3 | 64 % (2,0) | 6 % (2,5) |
   | **8** | 25 % | 2,8 | 42 % (2,4) | 22 % (2,8) |
   | 9 | 30 % | 3,6 | 47 % (2,9) | 19 % (3,5) |

   Resultado: **Flautista desde 9 jugadores, Lobo blanco desde 8.**

## Consecuencias

- Las cifras comparan roles entre sí, no predicen partidas reales: jugadores de verdad votan mejor que al azar. Si el juego cambia (roles, temporizadores, reglas de voto), se vuelve a ejecutar el script y se revisan los mínimos.
- Entre 9 y 11 jugadores el mazo recomendado favorece a la aldea con o sin Lobo blanco (solo 2 lobos); es cosa del mazo base, no del solitario.
- Un snapshot de partida guardado antes del cambio con una Niña dentro seguiría funcionando en el motor (su carta ya no tiene poder), pero el cliente no tendría su nombre traducido. Desplegar sin partidas en curso.
