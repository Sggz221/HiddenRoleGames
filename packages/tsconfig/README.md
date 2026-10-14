# @howlsinthedark/tsconfig

Configuraciones TypeScript compartidas:

| Archivo | Para |
|---|---|
| `base.json` | Base estricta |
| `library.json` | `shared`, `game-engine` (sin DOM ni Node) |
| `node.json` | `server`, `bots` |
| `react.json` | `web` |

Uso: `{ "extends": "@howlsinthedark/tsconfig/node.json" }` (añadir `"@howlsinthedark/tsconfig": "workspace:*"` a devDependencies).
