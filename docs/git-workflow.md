# Flujo de trabajo Git (Git Flow)

## Ramas permanentes

| Rama | Propósito | Despliega en | Protección |
|---|---|---|---|
| `main` | Código en producción. Cada merge es una versión etiquetada (`vX.Y.Z`). | Railway **production** | Solo PR desde `release/*` o `hotfix/*`; CI verde obligatorio |
| `develop` | Integración de lo próximo a publicar. | Railway **development** | Solo PR; CI verde obligatorio |

**Rama por defecto del repositorio:** `develop` (Settings → General → Default branch), para que las PR apunten ahí sin elegirlo cada vez.

## Ramas temporales

| Prefijo | Sale de | Se fusiona en | Uso |
|---|---|---|---|
| `feature/<hito>-<tema>` | `develop` | `develop` | Funcionalidad nueva. Ej.: `feature/h1-witch-role` |
| `fix/<tema>` | `develop` | `develop` | Bug no urgente |
| `chore/`, `docs/`, `refactor/`, `test/`, `ci/` | `develop` | `develop` | Mantenimiento |
| `release/<x.y.z>` | `develop` | `main` **y** `develop` | Congelar versión, últimos ajustes, bump de versión |
| `hotfix/<x.y.z>` | `main` | `main` **y** `develop` | Arreglo urgente en producción |

`branch-policy.yml` valida en CI la dirección de los merges.

## Ciclo habitual

```bash
# Nueva tarea
git switch develop && git pull
git switch -c feature/h1-witch-role
# ... commits (Conventional Commits) ...
git push -u origin feature/h1-witch-role
# PR → develop (squash merge). Development se despliega solo.

# Publicar al terminar un hito
git switch develop && git pull
git switch -c release/0.1.0
# ajustes finales, bump de versión
# PR → main (merge commit) → etiquetar v0.1.0 → PR main → develop (o merge directo)

# Hotfix
git switch main && git pull
git switch -c hotfix/0.1.1
# PR → main, etiquetar, y llevar el arreglo a develop
```

## Convenciones

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat(engine): ...`). Lo valida el hook `commit-msg`.
  Ámbitos: `web`, `server`, `shared`, `engine`, `bots`, `infra`, `deps`, `docs`.
- **Merge a `develop`:** squash. **Merge a `main`:** merge commit (conserva la historia de la release).
- **Versionado:** SemVer. `0.x` hasta la beta (Hito 5). Una release por hito como mínimo.
- **Hooks (lefthook):** pre-commit → Biome sobre archivos staged; pre-push → typecheck + tests.

## Protección de ramas en GitHub (configurar una vez)

Settings → Rules → Rulesets, para `main` y `develop`:
- Require a pull request before merging.
- Require status checks: `Lint · Typecheck · Test · Build`, `gitflow`.
- Block force pushes y deletions.
