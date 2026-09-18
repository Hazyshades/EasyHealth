# Proposal: eh-151-scoped-expiring-share-links

Domain: **reports / auth-shell**

## Why

The application has no public report access boundary. Sending a report currently requires an authenticated session, while an ad hoc public URL would risk exposing unrelated reports, raw storage paths, stale content, or a reusable bearer credential without expiry or revocation.

## What Changes

- Add owner-authorized creation of share links for validated reports with an explicit resource scope and expiry.
- Generate high-entropy bearer tokens, store only a keyed digest, and never persist or log the plaintext token.
- Support an optional PIN stored as a slow password hash with bounded failure attempts.
- Add a public access page/API that authenticates only the presented token and optional PIN, returns generic failures, and sets `Cache-Control: no-store` and `X-Robots-Tag: noindex`.
- Enforce expiry, revocation, profile ownership, exact report/document scope, and download policy on every public read.
- Default shares to the validated report snapshot; raw document downloads require explicit per-document scope and active authorization.
- Leave owner listing, access-history UI, and revoke controls to EH-152.

## Capabilities

### New Capabilities

- `scoped-report-sharing`: Expiring, revocable, explicitly scoped public access to validated report resources.

### Modified Capabilities

_None._

## Impact

This change adds share-link persistence, token/PIN verification, public routes, no-store/noindex response policy, and rate-limit seams. It must consume the EH-148 report contract and EH-150 validation result. The detailed threat model and release evidence are owned by EH-154.
