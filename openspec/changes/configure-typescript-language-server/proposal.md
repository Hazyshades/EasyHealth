## Why

EasyHealth has separate TypeScript projects for the Next.js application and the document worker, but no repository-owned editor configuration identifies either project to a TypeScript language server. Maintainers therefore fall back to text search for exported-symbol callsites, which is unsafe for refactors and loses diagnostics that the compiler can provide.

## What Changes

- Add a repository-owned VS Code workspace configuration that recommends the TypeScript tooling and explicitly associates application and worker folders with their respective `tsconfig.json` projects.
- Document the supported editor workflow and fallback `typecheck` commands for the application and worker.
- Add a deterministic verification script that confirms both project configurations remain discoverable and independently type-checkable.

## Capabilities

### New Capabilities
- `typescript-editor-integration`: Repository-owned TypeScript project discovery and editor setup for the application and document worker.

### Modified Capabilities
- None.

## Impact

- New `.vscode/` workspace configuration and repository developer documentation.
- `package.json` scripts and TypeScript project configuration validation.
- No runtime, database, clinical, or user-facing behavior changes.