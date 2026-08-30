## Why

Stale Next.js route-validator output can make a correct source tree fail type-checking after a route deletion. Contributors need one cross-platform cleanup command before validating generated artifacts.

## What Changes

- Add a Node-based cleanup command for `.next` and `out` that works on Windows and Unix-like hosts.
- Run cleanup before root typecheck and production build.

## Capabilities

### New Capabilities
- `generated-artifact-cleanup`: Deterministic removal of stale Next.js build artifacts.

### Modified Capabilities
- None.

## Impact

- Target domain: auth-shell (Next.js application build tooling).
- Package scripts and a cleanup helper; no runtime behavior changes.