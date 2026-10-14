# ADR 0006: Avatares de aldeano derivados del id del jugador

- **Estado:** aceptada
- **Fecha:** 2026-10-14
- **Desarrolla:** PLAN.md §2 (`components/`: avatares)

## Contexto

Los jugadores se distinguían solo por un círculo de color con sus iniciales. Queremos que cada uno tenga un retrato de aldeano (tono de piel, género, peinado, color de pelo y ropa de pueblo medieval) elegido al azar, pero que todos los clientes vean el mismo retrato para la misma persona, también al reconectar y al pasar del lobby a la partida.

## Decisión

1. **El retrato se deriva del id del jugador en el cliente.** `avatarTraits(id)` (`apps/web/src/components/avatar/traits.ts`) convierte el id en una semilla (FNV-1a) y elige los rasgos con un generador pequeño (mulberry32). El id es un UUID aleatorio que asigna el servidor, así que el resultado es aleatorio por jugador y estable en todas las pantallas.
2. **Sin cambios de protocolo.** El id ya viaja en `room:state` y en `PublicPlayer`; no hace falta un campo nuevo ni esquema Zod.
3. **Puramente cosmético.** El retrato no depende del rol ni de nada secreto, así que no filtra información. Las líneas anónimas del chat (la Niña espiando a la manada) no muestran retrato.
4. **SVG propio** (`VillagerAvatar`): sin imágenes ni assets externos, escala a cualquier tamaño y pesa poco.

## Consecuencias

- **No se puede elegir el avatar.** Si algún día se quiere personalizar, el servidor guardaría una semilla o unos rasgos elegidos por el jugador en el miembro de la sala, y `avatarTraits` los usaría en lugar del id. El componente no cambiaría.
- **Cambiar la lista de rasgos cambia los retratos** de todos (el mismo id cae en otra opción). Es aceptable mientras no haya cuentas persistentes; con cuentas, convendría guardar los rasgos ya resueltos.
- **Colisiones posibles:** con 7 tonos de piel, 2 géneros, 5 peinados, 8 colores de pelo, 4 prendas y 8×7 combinaciones de color, dos jugadores casi nunca coinciden, y el color de fondo del asiento los distingue igualmente en la mesa.
