## Why

A `verify:registry` failure can be buried in a long CI log. Reviewers need the failing output in the GitHub Actions job summary without changing registry verification behavior.

## What Changes

- Capture `verify:registry` output in its workflow step.
- On failure, append a bounded diagnostic block to `$GITHUB_STEP_SUMMARY` and preserve the failing exit status.

## Capabilities

### New Capabilities
- `registry-ci-diagnostics`: Actionable registry verification failure summary.

### Modified Capabilities
- None.

## Impact

- Measurement Registry CI workflow only.