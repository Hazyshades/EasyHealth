## Context

The repository has two independent TypeScript projects: the root Next.js application (`tsconfig.json`) and the document worker (`worker/tsconfig.json`). The root project deliberately excludes `worker`, so editor auto-discovery at the repository root can miss worker diagnostics. There is no `.vscode` configuration today.

## Goals / Non-Goals

**Goals:**
- Make both TypeScript projects discoverable from a fresh VS Code checkout.
- Keep the configuration editor-specific and non-invasive to runtime/build behavior.
- Provide CI-usable verification that catches a missing or mis-targeted project configuration.

**Non-Goals:**
- Installing a language server in the Oh My Pi harness.
- Replacing TypeScript compiler configuration or changing application/worker source semantics.
- Mandating VS Code as the only supported editor.

## Decisions

### Commit VS Code workspace metadata

Add `.vscode/extensions.json` to recommend the official TypeScript tooling and `.vscode/settings.json` with explicit `typescript.tsdk` and project discovery settings. This gives contributors a zero-configuration path without making editor metadata machine-local.

Alternative: document manual editor setup only. Rejected because it does not make TypeScript project discovery repeatable.

### Keep application and worker as separate configured projects

Preserve existing `tsconfig.json` boundaries and let the editor discover both files. A synthetic root solution `tsconfig.json` would be misleading because Next.js and worker compiler constraints differ.

Alternative: merge the worker into root `include`. Rejected because root intentionally excludes `worker`, and it would let application-only Next.js behavior leak into the worker project.

### Verify structure and compilation through an explicit script

Add a small repository script that checks the expected project files and invokes each existing TypeScript compiler project with `--noEmit`. This proves configuration integrity without depending on an interactive editor.

## Risks / Trade-offs

- VS Code recommendations do not configure non-VS-Code editors; the documented commands remain the portable fallback.
- The harness may still lack an active TypeScript language server; repository configuration cannot install or start one.
- Both compiler projects add validation time, but they are the authoritative source for the editor configuration.