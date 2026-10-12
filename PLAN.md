# Plan de proyecto: juego web multijugador de rol oculto (tipo "Hombres Lobo")

> Documento de partida para desarrollar con Claude Code en un monorepo.
> Está pensado para que Claude lo lea al inicio de cada sesión: decisiones ya tomadas, estructura, convenciones, hoja de ruta con criterios de aceptación e infraestructura.

---

## 0. Resumen ejecutivo

Juego web en tiempo real para 5-20 jugadores donde cada uno recibe un rol secreto y la partida avanza por fases (noche/día). El servidor actúa como **narrador automático** y única fuente de verdad. Los jugadores entran con un enlace/código de sala desde el móvil, sin instalar nada.

Decisiones clave:

1. **Web, no motor de juego.** Es un juego de texto, votaciones y fases; HTML/CSS/JS con animaciones es lo óptimo.
2. **TypeScript de extremo a extremo** en un monorepo, para compartir tipos y validaciones entre cliente y servidor.
3. **Servidor autoritativo** con el estado de las partidas **en memoria** (una instancia) en el MVP. PostgreSQL solo cuando haya cuentas e historial.
4. **Motor de reglas puro** (sin red ni timers) en su propio paquete, 100% testeable.
5. **Un solo servicio en producción** que sirve el frontend compilado y los WebSockets (mismo origen, sin CORS, mínimo coste).
6. **Mobile-first.** La mayoría de jugadores entrarán desde el teléfono.

### Nota sobre nombre y arte (importante)

"Los Hombres Lobo de Castronegro" es un juego comercial con marca registrada y arte propio. Para publicar, usa **nombre propio, textos propios e ilustraciones propias o con licencia**. Las mecánicas (reglas de un juego) no están protegidas, pero el nombre, las ilustraciones y los textos sí. En este documento se usa el nombre de trabajo **"Aullidos"** (cámbialo cuando quieras; está centralizado en una constante).

---

## 1. Stack tecnológico

### 1.1 Monorepo y tooling

| Pieza | Elección | Motivo |
|---|---|---|
| Gestor de paquetes | **pnpm** (workspaces) | Rápido, estricto con dependencias, estándar en monorepos |
| Orquestador | **Turborepo** | Caché de builds/tests, pipelines simples |
| Lenguaje | **TypeScript** (`strict: true`) | Tipos compartidos cliente/servidor, mucho soporte de Claude |
| Runtime | **Node.js LTS** (fijar en `.nvmrc` y `engines`) | Estable, soportado en Railway |
| Lint + formato | **Biome** | Una sola herramienta, muy rápida |
| Tests unitarios | **Vitest** | Integrado con Vite, rápido |
| Tests E2E | **Playwright** | Simula varios navegadores/jugadores a la vez |
| Git hooks | **lefthook** o husky + lint-staged | Lint y typecheck antes de commit |
| CI | **GitHub Actions** | Lint, typecheck, tests, build en cada PR |

### 1.2 Frontend (`apps/web`)

| Pieza | Elección | Uso |
|---|---|---|
| Framework | **React + Vite** | SPA, build estático |
| Estilos | **Tailwind CSS** + variables CSS para temas día/noche | Rapidez y consistencia |
| Animaciones UI | **Motion** (antes Framer Motion) | Voltear carta de rol, entradas/salidas de jugadores, votos, muertes (`AnimatePresence`) |
| Secuencias complejas | **GSAP** (solo si hace falta) | Amanecer/anochecer, anuncio de muertes con línea de tiempo |
| Animaciones pre-hechas | **Lottie** o **Rive** | Lobo aullando, poción de la bruja, etc. |
| Ambiente | **tsParticles** | Niebla, luciérnagas, ceniza |
| Audio | **Howler.js** | Música/ambiente por fase, efectos |
| Estado cliente | **Zustand** | Estado global ligero alimentado por eventos del socket |
| Routing | **React Router** | `/`, `/sala/:codigo`, `/ajustes`... |
| WebSocket | **socket.io-client** | Reconexión y acks incluidos |
| i18n | **i18next** | Español primero, preparado para más idiomas |
| Iconos | **lucide-react** | Ligeros y consistentes |

Si más adelante se quiere escenario 3D/2D con efectos avanzados: **react-three-fiber** o **PixiJS**. No entran en el MVP.

### 1.3 Backend (`apps/server`)

| Pieza | Elección | Uso |
|---|---|---|
| HTTP | **Fastify** | Healthcheck, servir estáticos, endpoints REST (cuentas, historial) |
| Tiempo real | **Socket.IO** | Salas, reconexión, acks, canales por rol |
| Validación | **Zod** (esquemas en `packages/shared`) | Toda entrada del cliente se valida |
| Logging | **pino** | Logs estructurados JSON |
| Rate limiting | `rate-limiter-flexible` o lógica propia | Anti-spam de chat y acciones |
| Errores/monitorización | **Sentry** (plan gratuito) | Excepciones en servidor y cliente |
| ORM (fase 2) | **Drizzle ORM** + PostgreSQL | Cuentas, historial, estadísticas |
| Auth (fase 2) | Sesión por cookie + OAuth (Discord/Google) | Cuentas opcionales; invitados siempre permitidos |

> **Alternativa descartada:** ASP.NET Core + SignalR (encaja con tu experiencia previa con C#). Es una opción perfectamente válida, pero obliga a duplicar tipos y validaciones entre C# y TypeScript. En un monorepo desarrollado con Claude, compartir tipos y esquemas Zod entre cliente y servidor reduce errores de protocolo. Si prefieres C#, la arquitectura de este documento se mantiene igual (motor puro + servidor autoritativo); solo cambia `apps/server` y `packages/shared` pasaría a generarse desde un contrato.

### 1.4 Datos

- **MVP:** estado de partidas solo en memoria. Si el servidor se reinicia, las partidas en curso se pierden (aceptable al inicio; se evita desplegando en horas valle).
- **Fase 2:** PostgreSQL (Railway) para usuarios, partidas terminadas, estadísticas.
- **Fase 3 (si hace falta):** snapshots del estado de sala en Redis/Postgres para sobrevivir a despliegues, y adaptador Redis de Socket.IO para escalar a varias instancias. **No antes de necesitarlo.**

---

## 2. Estructura del monorepo

```
aullidos/
├── apps/
│   ├── web/                    # React + Vite (cliente)
│   │   ├── src/
│   │   │   ├── app/            # rutas, providers, layout
│   │   │   ├── features/
│   │   │   │   ├── lobby/      # crear/unirse a sala, ajustes de partida
│   │   │   │   ├── game/       # pantalla de juego por fases
│   │   │   │   ├── chat/       # canales: general, lobos, muertos
│   │   │   │   └── roles/      # carta de rol, acciones por rol
│   │   │   ├── components/     # UI genérica (botones, modales, avatares)
│   │   │   ├── animations/     # variantes de Motion, timelines GSAP
│   │   │   ├── audio/          # gestor de sonido
│   │   │   ├── net/            # cliente socket, sincronización de reloj
│   │   │   ├── store/          # Zustand
│   │   │   └── i18n/
│   │   └── public/             # assets estáticos (sprites, audio, lotties)
│   └── server/                 # Fastify + Socket.IO
│       └── src/
│           ├── http/           # healthcheck, rutas REST, estáticos
│           ├── realtime/       # handlers de socket, middleware
│           ├── rooms/          # RoomManager, Room, timers, reconexión
│           ├── persistence/    # (fase 2) Drizzle, repositorios
│           └── config/         # variables de entorno validadas con Zod
├── packages/
│   ├── shared/                 # protocolo: tipos, esquemas Zod, constantes
│   ├── game-engine/            # reglas del juego, funciones puras
│   ├── tsconfig/               # configs TS compartidas
│   └── bots/                   # clientes bot para tests y pruebas de carga
├── docs/
│   ├── game-design.md          # reglas, roles, fases, casos límite
│   ├── protocol.md             # eventos cliente↔servidor
│   ├── decisions/              # ADRs (una decisión por archivo)
│   └── art-and-sound.md        # lista de assets y licencias
├── .github/workflows/ci.yml
├── Dockerfile
├── turbo.json
├── pnpm-workspace.yaml
├── biome.json
├── CLAUDE.md                   # instrucciones persistentes para Claude
└── PLAN.md                     # este documento
```

Reglas de dependencias (importante para mantener el orden):

- `game-engine` depende solo de `shared`. **No** importa Socket.IO, Node ni React.
- `server` depende de `game-engine` y `shared`.
- `web` depende de `shared` y, solo para tipos/ayudas de visibilidad, del `game-engine` (nunca para ejecutar la lógica real; el cliente no decide nada).
- `shared` no depende de nadie del monorepo.

---

## 3. Diseño del juego

### 3.1 Roles (por oleadas)

**MVP (v1):**

| Rol | Bando | Habilidad |
|---|---|---|
| Aldeano | Aldea | Sin habilidad; vota de día |
| Lobo | Lobos | Cada noche los lobos eligen por consenso/votación a una víctima |
| Vidente | Aldea | Cada noche descubre el rol de un jugador |
| Bruja | Aldea | Una poción de curación y una de veneno en toda la partida |
| Cazador | Aldea | Al morir, dispara a otro jugador |
| Cupido | Aldea | Noche 1: elige dos enamorados; si uno muere, muere el otro |

**v2 (añadir con el motor ya estable):** Niña (espía), Ladrón, Capitán/Alguacil (voto doble, elegido de día 1), Salvador (protege), Hombre lobo blanco, Flautista, Hermanos...

El sistema de roles debe ser **extensible**: cada rol es un módulo con su definición (bando, orden de despertar, acciones permitidas, validadores, efectos). Añadir un rol no debe tocar el núcleo del motor.

### 3.2 Fases y orden

```
LOBBY → (inicio) → REPARTO_ROLES
  → NOCHE (n)
      1. Cupido (solo noche 1)
      2. Enamorados se reconocen (solo noche 1)
      3. Vidente
      4. Lobos
      5. Bruja
  → AMANECER (anuncio de muertes, resolución de efectos en cadena)
  → [CAZADOR dispara si ha muerto]
  → [comprobar victoria]
  → DEBATE (chat abierto, temporizador)
  → VOTACIÓN (linchamiento)
  → RESOLUCIÓN (muerte del votado, posible disparo del cazador)
  → [comprobar victoria]
  → NOCHE (n+1)
  → ...
FIN (victoria Aldea / Lobos / Enamorados / otros) → resumen y revancha
```

Cada fase de rol nocturno tiene un **temporizador fijo** aunque el rol esté muerto o no exista, para no revelar información por el tiempo que tarda la noche. Si el jugador no actúa, se resuelve como "sin acción".

### 3.3 Reglas configurables por sala

- Número de jugadores y conjunto de roles (con presets recomendados por número de jugadores).
- Duración de debate, votación y acciones nocturnas.
- Qué se revela al morir (rol / bando / nada).
- Empates en votación: nadie muere / segunda votación / decide el capitán.
- Modo narrador: **automático** (por defecto) o **humano** (un jugador narra y el servidor solo gestiona; v2).
- Chat de muertos activo/desactivado.
- Sala pública o privada con código.

### 3.4 Casos límite que el motor debe cubrir (con tests)

- Bruja salva a la víctima de los lobos y a la vez envenena a otro.
- Víctima de los lobos es enamorada → muere su pareja → la pareja es el cazador → dispara.
- Cazador muere durante la noche y dispara en el amanecer, causando una cadena de muertes.
- Todos los lobos mueren / quedan solo lobos y un aldeano / quedan solo los dos enamorados (condiciones de victoria).
- Votación empatada según cada configuración.
- Jugador se desconecta o abandona durante su acción nocturna.
- Anfitrión abandona la sala (traspaso de host).

---

## 4. Arquitectura

### 4.1 Principio central: servidor autoritativo

El cliente **nunca** decide nada: envía *intenciones* ("quiero votar a X") y recibe *vistas* ("este es el estado que tú puedes ver"). Toda acción se valida en servidor según fase, rol, vida del jugador y reglas.

### 4.2 Motor de reglas puro (`packages/game-engine`)

```ts
// Idea de API (sin I/O, sin timers, sin aleatoriedad oculta)
type Engine = {
  createGame(config: GameConfig, players: Player[], rng: Rng): GameState;
  applyAction(state: GameState, actor: PlayerId, action: Action): Result<{
    state: GameState;
    events: GameEvent[];      // lo que ha pasado (para animar y narrar)
  }>;
  advancePhase(state: GameState): { state: GameState; events: GameEvent[] };
  projectFor(state: GameState, viewer: PlayerId): PlayerView; // oculta lo secreto
  getWinner(state: GameState): Winner | null;
};
```

- Todo estado es **inmutable** y serializable (JSON), lo que permite snapshots, tests y futuras repeticiones.
- La aleatoriedad entra por un `Rng` inyectable con semilla → tests deterministas y repeticiones de partida.
- `projectFor` es la **única** vía por la que el estado sale al cliente. Es el punto más crítico de seguridad: nunca se envía el `GameState` completo.

### 4.3 Servidor (`apps/server`)

- **`RoomManager`**: crea/destruye salas, genera códigos (5-6 caracteres, alfabeto sin ambiguos), limpia salas vacías o inactivas.
- **`Room`**: contiene el `GameState`, la lista de conexiones, los timers y la cola de acciones. Procesa las acciones **de forma secuencial** (una cola por sala) para evitar condiciones de carrera.
- **Timers**: el servidor guarda `phaseEndsAt` (timestamp). Al vencer, avanza la fase. Se envía al cliente el timestamp + referencia de reloj del servidor para que el contador sea fiable aunque el reloj del cliente esté desfasado.
- **Reconexión**: cada jugador recibe un `sessionToken` (guardado en `localStorage`) al unirse. Si se desconecta, su asiento se mantiene un tiempo de gracia; al volver, recibe su `PlayerView` actual. Si no vuelve, se aplica la política configurada (acción nula, expulsión...).
- **Canales de chat**: `general` (todos los vivos, de día), `lobos` (solo lobos vivos, de noche), `muertos` (solo muertos), `enamorados` (opcional). La pertenencia al canal se decide en servidor al emitir.

### 4.4 Protocolo (resumen; detalle en `docs/protocol.md`)

Cliente → Servidor:

| Evento | Descripción |
|---|---|
| `room:create` / `room:join` / `room:leave` | Gestión de sala |
| `room:updateConfig` | Solo anfitrión |
| `room:start` | Solo anfitrión |
| `game:action` | `{ type: 'vote' \| 'wolfTarget' \| 'seerInspect' \| 'witchHeal' \| 'witchPoison' \| 'hunterShoot' \| 'cupidLink' \| 'skip', target?: PlayerId }` |
| `chat:send` | `{ channel, text }` |
| `session:resume` | Reconexión con token |

Servidor → Cliente:

| Evento | Descripción |
|---|---|
| `room:state` | Lobby: jugadores, config, anfitrión |
| `game:view` | `PlayerView` completo tras cambios relevantes |
| `game:events` | Lista de eventos para animar/narrar (amanecer, muertes, votos) |
| `chat:message` | Mensaje con canal y autor |
| `error` | Código + mensaje; la acción se rechazó |

Todos los payloads tienen esquema Zod en `packages/shared`. Todo mensaje inválido se descarta y se cuenta para rate limiting.

### 4.5 Frontend

- El store de Zustand guarda la última `PlayerView` y la cola de `game:events`.
- Los **eventos** se reproducen en una cola de animaciones secuencial (p. ej. "amanece → se muestra a los muertos uno a uno → se actualiza el tablero"). Así la lógica nunca depende de las animaciones, y se pueden saltar o acelerar.
- Tema día/noche mediante variables CSS que cambian con una transición; el cielo/luna/sol es una capa animada con Motion o GSAP.
- Accesibilidad: respetar `prefers-reduced-motion` (animaciones reducidas), contraste suficiente, no depender solo del color para información.

---

## 5. Seguridad y fair play

- **Nunca** enviar roles ajenos ni el estado completo. Test automático: para cada fase y rol, comprobar que `projectFor` no filtra información prohibida.
- Validar **cada** acción en servidor: ¿es su fase? ¿su rol? ¿está vivo? ¿objetivo válido? ¿ya actuó?
- Rate limiting por socket e IP (chat, creación de salas, intentos de unión).
- Códigos de sala no predecibles y con límite de intentos de unión.
- Sanitización del chat (React escapa por defecto; limitar longitud, filtro básico de insultos configurable).
- Herramientas del anfitrión: expulsar, silenciar, cerrar sala. Botón de reportar (fase 2).
- CORS cerrado (mismo origen en producción), cabeceras de seguridad (Helmet), HTTPS obligatorio.
- Sin secretos en el cliente. Variables de entorno validadas al arrancar.
- Privacidad/RGPD: política de privacidad simple, no recoger datos personales innecesarios, avisar si se usan cookies.
- Límite de jugadores por sala y de salas por IP/instancia para evitar abuso de recursos.

---

## 6. Testing

| Nivel | Qué | Herramienta |
|---|---|---|
| Unitario | Todo el motor: cada rol, cada transición, cada caso límite de §3.4 | Vitest |
| Propiedades | Partidas aleatorias con bots: invariantes (siempre termina, nunca hay estados inválidos) | Vitest + `fast-check` |
| Visibilidad | `projectFor` no filtra secretos en ninguna fase | Vitest |
| Integración | Servidor real con clientes `socket.io-client`: sala completa de principio a fin | Vitest |
| E2E | Varios navegadores simulando una partida | Playwright |
| Carga | 200-500 sockets simultáneos con bots (`packages/bots`) | Script propio o k6 |

Objetivo: **cobertura alta en `game-engine`** (es el corazón y lo más fácil de testear); el resto, tests de humo y de integración de los flujos críticos.

---

## 7. Infraestructura

### 7.1 Entornos

| Entorno | Dónde | Notas |
|---|---|---|
| Local | `pnpm dev` (web con HMR + servidor con recarga) | Sin dependencias externas en el MVP |
| Staging (opcional) | Railway (entorno aparte o previews de PR) | Para probar con amigos antes de publicar |
| Producción | Railway | Un servicio con web + WebSocket |

### 7.2 Despliegue en Railway

- **Un único servicio** (Docker multi-stage): compila `web`, compila `server`, y el servidor sirve `web/dist` como estáticos + WebSocket en el mismo puerto (`PORT`).
- Ventajas: sin CORS, un solo dominio, mínimo consumo del crédito mensual.
- **Healthcheck:** `GET /health` → 200. Configurarlo en Railway.
- **Apagado limpio:** manejar `SIGTERM` (avisar a clientes, dejar de aceptar salas nuevas, cerrar conexiones).
- **Una sola réplica** mientras el estado esté en memoria (si hay dos instancias, los jugadores de una misma sala podrían caer en servidores distintos).
- Proyecto de Railway **independiente** de otros proyectos, con su propio límite de gasto configurado.
- PostgreSQL (plugin de Railway) **solo cuando empiece la fase 2**.

Variables de entorno (validadas con Zod al arrancar):

```
NODE_ENV=production
PORT=                       # lo inyecta Railway
PUBLIC_URL=https://tu-dominio
SENTRY_DSN=
SESSION_SECRET=             # fase 2
DATABASE_URL=               # fase 2
DISCORD_CLIENT_ID= / DISCORD_CLIENT_SECRET=   # fase 2, opcional
```

### 7.3 Dominio, DNS y CDN

- Dominio propio (unos 10-15 €/año) apuntado a Railway.
- DNS en **Cloudflare** (gratis): proxy activado, HTTPS, caché de assets estáticos y protección básica contra abuso. Cloudflare soporta WebSockets.
- Assets pesados (audio, lotties, sprites) con nombres versionados (hash) y caché larga.

### 7.4 Dockerfile (esquema)

```dockerfile
FROM node:lts-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@aullidos/server --filter=@aullidos/web

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app .
RUN pnpm install --frozen-lockfile --prod
EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
```

### 7.5 CI/CD

- **PR:** lint (Biome) → typecheck → tests unitarios y de integración → build.
- **Merge a `main`:** despliegue automático a Railway (staging primero si existe).
- E2E de Playwright en CI de forma programada o en PRs que toquen `apps/web` o `apps/server`.
- Dependabot/Renovate para actualizar dependencias de forma controlada.

### 7.6 Observabilidad

- Logs JSON con `pino` (visibles en Railway).
- **Sentry** en servidor y cliente.
- Métricas simples expuestas en una ruta protegida: salas activas, jugadores conectados, partidas por hora, latencia de acciones.
- Analítica ligera y sin cookies (Plausible, Umami autoalojado o Cloudflare Web Analytics).

### 7.7 Alternativa de bajo coste: servidor propio

Si prefieres no depender de Railway: el mismo contenedor Docker puede ejecutarse en un mini PC en casa detrás de un **Cloudflare Tunnel** (sin abrir puertos). Trade-offs: coste cero de hosting, pero dependes de tu conexión, tu electricidad y tu mantenimiento. Para el MVP con amigos funciona; para un público abierto, mejor un VPS o Railway.

### 7.8 Estimación de costes

| Concepto | Coste aproximado |
|---|---|
| Railway (compartiendo el plan que ya pagas) | 0-5 € extra/mes, según consumo |
| Dominio | 10-15 €/año |
| Cloudflare, Sentry, GitHub Actions (planes gratuitos) | 0 € |
| Arte/sonido | Variable: assets propios, bancos con licencia o encargos |

---

## 8. Hoja de ruta con criterios de aceptación

Cada hito termina con **código desplegable, tests en verde y documentación actualizada**.

### Hito 0: Cimientos
- Monorepo con pnpm + Turborepo, TS estricto, Biome, Vitest, CI en GitHub Actions.
- `CLAUDE.md` y `docs/` iniciales. Dockerfile y despliegue "hola mundo" en Railway con `/health`.
- **Aceptación:** `pnpm dev`, `pnpm test`, `pnpm build` funcionan; el CI pasa; hay URL pública.

### Hito 1: Motor de reglas (sin red, sin UI)
- Roles del MVP, fases, condiciones de victoria, `projectFor`, RNG con semilla.
- Tests de todos los casos límite de §3.4 + tests de propiedades con bots.
- **Aceptación:** una partida completa simulada por bots termina siempre en victoria válida; `projectFor` no filtra secretos.

### Hito 2: Servidor en tiempo real
- Salas con código, unirse/salir, host, config, inicio, ejecución de partida con timers, reconexión con token, chat por canales.
- Tests de integración con clientes reales de Socket.IO.
- **Aceptación:** 6-8 bots juegan una partida completa contra el servidor; una desconexión y reconexión a mitad de partida funciona.

### Hito 3: Cliente jugable (feo pero funcional)
- Lobby, pantalla de juego por fases, acciones por rol, votación, chat, contador sincronizado, reconexión.
- Mobile-first, sin animaciones todavía.
- **Aceptación:** 5+ personas reales pueden jugar una partida completa desde el móvil.

### Hito 4: Animación, sonido y pulido
- Tema día/noche, carta de rol, anuncio de muertes, votos animados, partículas, audio ambiental, `prefers-reduced-motion`.
- Cola de animaciones basada en `game:events` (saltable).
- **Aceptación:** 60 fps en un móvil de gama media; el juego sigue siendo jugable con animaciones desactivadas.

### Hito 5: Robustez y lanzamiento privado (beta)
- Rate limiting, moderación básica, Sentry, métricas, pruebas de carga, apagado limpio.
- Política de privacidad y términos básicos. Nombre y arte finales.
- **Aceptación:** prueba de carga de 200+ conexiones estable; beta cerrada con amigos sin incidencias graves.

### Hito 6 (fase 2): Cuentas y progreso
- PostgreSQL + Drizzle, login con Discord/Google, historial, estadísticas, perfiles y avatares.
- **Aceptación:** un usuario puede ver su historial; los invitados siguen pudiendo jugar.

### Hito 7+ (ideas)
- Más roles, modo narrador humano, salas públicas con matchmaking, repeticiones de partida, torneos, PWA instalable, más idiomas.

---

## 9. Cómo trabajar con Claude en este repo

### 9.1 Archivo `CLAUDE.md` (copiar a la raíz)

```markdown
# Aullidos: instrucciones para Claude

## Qué es
Juego web multijugador de rol oculto (tipo "Hombres Lobo"). Monorepo pnpm + Turborepo.
Lee PLAN.md para el contexto completo antes de proponer cambios de arquitectura.

## Comandos
- `pnpm dev`: web + servidor con recarga
- `pnpm test`: tests (Vitest) de todo el monorepo
- `pnpm lint` / `pnpm typecheck` / `pnpm build`

## Reglas de oro
1. El servidor es la única fuente de verdad. El cliente nunca decide reglas.
2. La lógica del juego vive SOLO en `packages/game-engine` y es pura (sin I/O, sin Date.now(), sin Math.random(); usar Rng inyectado).
3. Nunca enviar `GameState` completo al cliente: solo `projectFor(state, viewer)`.
4. Todo payload de red tiene esquema Zod en `packages/shared` y se valida en servidor.
5. Toda regla o rol nuevo lleva tests, incluyendo casos límite.
6. TypeScript estricto: sin `any` ni `@ts-ignore` sin justificación comentada.
7. Cambios pequeños y enfocados; un tema por commit/PR.
8. Textos de usuario en `i18n`, nunca hardcodeados en componentes.
9. Respetar `prefers-reduced-motion` en toda animación nueva.

## Antes de dar algo por terminado
Ejecutar lint, typecheck y tests. Si cambia el protocolo, actualizar `docs/protocol.md`.
Si se toma una decisión de arquitectura, añadir un ADR en `docs/decisions/`.

## Estilo
Código y comentarios en inglés; documentación de diseño y textos del juego en español.
```

### 9.2 Método de trabajo recomendado

1. **Un hito = una conversación/sesión enfocada.** Empieza pidiendo a Claude que lea `PLAN.md` y `CLAUDE.md` y proponga un plan de tareas del hito antes de escribir código.
2. **Tests primero en el motor.** Pide primero los casos de prueba de cada rol/regla y luego la implementación; es donde más ayuda tener una especificación ejecutable.
3. **Revisa los diffs, especialmente `projectFor`, validaciones y todo lo de seguridad.** Es lo que no debe fallar y lo más sutil.
4. **Documentos vivos:** al terminar cada hito, pide actualizar `docs/game-design.md`, `docs/protocol.md` y los ADRs. Así la siguiente sesión arranca con contexto fiel.
5. **Prompts concretos con criterio de aceptación.** Por ejemplo: "Implementa el rol Bruja en el motor con sus tests; criterio: pasan los casos 1 y 2 de §3.4 y `projectFor` no revela las pociones restantes a nadie más".
6. **Commits frecuentes** y ramas por tarea para poder revertir.

---

## 10. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Filtración de información oculta (roles) | Rompe el juego | `projectFor` como única salida + tests de visibilidad + revisión manual |
| Reinicio del servidor a mitad de partida | Partidas perdidas | Desplegar en horas valle; fase 3: snapshots de salas |
| Reglas con interacciones complejas entre roles | Bugs sutiles | Motor puro, tests de propiedades, casos límite documentados |
| Animaciones lentas en móviles modestos | Mala experiencia | Presupuesto de rendimiento, modo reducido, probar en dispositivos reales |
| Coste de Railway por encima del crédito | Gasto inesperado | Límite de gasto configurado; una sola réplica; poca RAM |
| Abuso (spam, salas masivas, trolls) | Servicio degradado | Rate limiting, límites por IP, herramientas de host |
| Problemas legales por nombre/arte de un juego comercial | Retirada del juego | Nombre, textos y arte propios o con licencia |
| Desfase de reloj en temporizadores | Votaciones confusas | Timestamps del servidor + sincronización de reloj |

---

## 11. Checklist antes de cada lanzamiento

- [ ] CI en verde (lint, typecheck, tests, build).
- [ ] Test de visibilidad de roles pasando.
- [ ] Prueba de partida completa con jugadores reales en móvil.
- [ ] Variables de entorno de producción revisadas; límite de gasto en Railway configurado.
- [ ] Healthcheck y apagado limpio verificados.
- [ ] Sentry recibiendo eventos de prueba.
- [ ] `docs/` y `CLAUDE.md` actualizados.
- [ ] Licencias de assets (arte, audio, fuentes) documentadas en `docs/art-and-sound.md`.

---

## 12. Primeros pasos (para empezar hoy)

1. Crear el repositorio y pegar este `PLAN.md` y el `CLAUDE.md` de §9.1 en la raíz.
2. Pedir a Claude: *"Lee PLAN.md y CLAUDE.md. Ejecuta el Hito 0: scaffolding del monorepo, CI, Dockerfile y `/health`. Antes de escribir código, muéstrame el plan de tareas."*
3. Desplegar el "hola mundo" en un proyecto nuevo de Railway y comprobar la URL pública.
4. Continuar con el Hito 1 (motor de reglas) sin tocar aún red ni interfaz.
