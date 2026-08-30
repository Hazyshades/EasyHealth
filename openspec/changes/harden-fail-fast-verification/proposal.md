## Why

Verification must preserve the first failing contract. Shell command composition can otherwise let a later presence search hide a failed verifier and publish a false-green result.

## What Changes

- Add a repository guard that rejects verification commands which append search/presence checks after a test runner.
- Keep executable verifiers and structural checks as independently named CI steps.

## Capabilities

### New Capabilities
- `fail-fast-verification`: Static enforcement that verification commands cannot mask earlier failures.

### Modified Capabilities
- None.

## Impact

- Verification scripts and CI workflow only; no runtime behavior changes.