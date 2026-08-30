## Why

Root metadata lacks a production base URL, so relative social metadata can resolve to localhost.

## What Changes

- Configure root `metadataBase` from `NEXT_PUBLIC_SITE_URL` with a production fallback.
- Validate the selected URL is absolute and does not silently use localhost.

## Capabilities

### New Capabilities
- `production-metadata-base`: Stable production origin for Next.js metadata.

### Modified Capabilities
- None.

## Impact

- Root application metadata and focused verifier only.