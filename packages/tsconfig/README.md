# @aullidos/tsconfig

Configuraciones TypeScript compartidas:

| Archivo | Para |
|---|---|
| `base.json` | Base estricta |
| `library.json` | `shared`, `game-engine` (sin DOM ni Node) |
| `node.json` | `server`, `bots` |
| `react.json` | `web` |

Uso: `{ "extends": "@aullidos/tsconfig/node.json" }` (añadir `"@aullidos/tsconfig": "workspace:*"` a devDependencies).
