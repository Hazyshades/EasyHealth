## Context

No repository-local Prettier installation currently governs whitespace or formatting. Full-tree formatting would rewrite generated registry documents and unrelated source, which is not appropriate for a bootstrap change.

## Goals / Non-Goals

**Goals:** pin one formatter; offer explicit write and check commands; exclude generated/dependency artifacts.

**Non-Goals:** reformat the existing repository or enforce formatting in CI in this change.

## Decisions

Use Prettier 3 as a root dev dependency, `prettier --write .` for opt-in formatting, and `prettier --check .` for validation. `.prettierignore` excludes dependencies, build outputs, generated docs, archive artifacts, and binary fixtures.

## Risks / Trade-offs

Future contributors must run `format` intentionally; no broad initial rewrite is hidden in dependency setup.