## Context

No repository-local Prettier installation currently governs whitespace or formatting. Full-tree formatting would rewrite generated registry documents and unrelated source, which is not appropriate for a bootstrap change.

## Goals / Non-Goals

**Goals:** pin one formatter; offer explicit write and check commands; exclude generated/dependency artifacts.

**Non-Goals:** reformat the existing repository or enforce formatting in CI in this change.

## Decisions

Use Prettier 3 as a root dev dependency, `prettier --write .` for opt-in formatting, and `prettier --check .` for validation. `.prettierignore` excludes dependencies, build outputs, generated docs, archive artifacts, and binary fixtures.

On 2026-08-30, the clean isolated install executed `pnpm format:check` and found 821 pre-existing formatting violations. The user chose to preserve the no-reformat scope rather than commit a repository-wide rewrite or weaken the check. The verification task remains incomplete until a dedicated baseline migration is approved.

## Risks / Trade-offs

Future contributors must run `format` intentionally; no broad initial rewrite is hidden in dependency setup. The strict full-tree check remains red until the repository adopts a formatting baseline.