## Why

Tracked text files are subject to platform-dependent CRLF conversion, while the repository includes binary fixtures. Deterministic Git attributes prevent needless diffs and protect binary assets.

## What Changes

- Define LF normalization for text files.
- Mark common image/PDF formats as binary while preserving the existing synthetic PDF rule.

## Capabilities

### New Capabilities
- `repository-line-ending-policy`: Deterministic text and binary Git attributes.

### Modified Capabilities
- None.

## Impact

- `.gitattributes` only; no runtime behavior changes.