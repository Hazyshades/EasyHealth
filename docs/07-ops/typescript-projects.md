# TypeScript projects

EasyHealth has separate TypeScript compiler projects for the Next.js application and the document worker. This guide makes both projects available to an editor and provides an editor-independent verification path.

## Context

The root `tsconfig.json` owns the application and deliberately excludes `worker/`. The worker has its own `worker/tsconfig.json`; do not combine the projects or use application diagnostics as evidence that the worker is valid.

## Editor setup

Open the repository root in VS Code and accept the workspace recommendation for TypeScript tooling. The checked-in `.vscode/settings.json` directs VS Code to the repository TypeScript SDK. VS Code discovers both `tsconfig.json` files and reports diagnostics for the application and worker independently.

Other editors may use their TypeScript language-server integration with the same two project files.

## Verification

Run the following command from the repository root:

```bash
pnpm typecheck:projects
```

The command checks that both project files exist and invokes TypeScript with `--noEmit` for each project. It prints the project currently being checked and exits non-zero at the first missing configuration or compiler failure.

## Problem

Without repository-owned project discovery, tooling can inspect only the Next.js project and miss document-worker diagnostics, forcing unsafe text-level callsite searches.

## Root cause

The application and worker use intentionally different compiler configurations, but no workspace metadata or combined verification command previously named both boundaries.

## Fix

The repository now provides VS Code workspace metadata, a deterministic verification script, and this guide.

## Verification

`pnpm typecheck:projects` is the authoritative non-editor check for this setup.