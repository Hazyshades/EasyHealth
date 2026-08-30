## Context

`.next` is generated output and can retain route type declarations after source routes are removed. Shell-specific deletion commands do not work consistently across developer environments.

## Goals / Non-Goals

**Goals:** remove `.next` and `out` cross-platform; make root typecheck/build begin from a clean generated-artifact state.

**Non-Goals:** remove dependencies, source files, or user-provided assets.

## Decisions

Use a small Node script with `rmSync(..., { recursive: true, force: true })`, then compose it into `typecheck` and `build` through `pre` lifecycle hooks. This avoids shell branching and keeps direct `next build` unchanged.

## Risks / Trade-offs

The command deletes only reproducible generated directories and makes typecheck/build slightly slower by regenerating Next metadata.