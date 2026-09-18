# Design: eh-150-report-citation-validator

## Context

EH-148 defines a versioned report/evidence DTO, but generation-time parsing alone cannot prove that every citation belongs to the profile, remains in the selected scope, and resolves to a permitted source. EH-151 and EH-153 must not each implement a weaker copy of those checks.

## Goals / Non-Goals

**Goals:**

- Provide one deterministic validation module for generation, persistence, sharing, and export.
- Enforce source identity, profile ownership, report scope, allowed evidence kinds, and claim citation rules.
- Return an auditable result with sanitized content and structured issues.
- Fail closed for broken or cross-profile citations.

**Non-Goals:**

- Semantic clinical fact checking or diagnosis detection.
- Replacing the EH-148 schema or source projection.
- Authorizing a public token; share authentication remains EH-151.

## Decisions

### 1. Expose a pure validator with an authorized source adapter

Add `src/lib/report-citation-validator.ts`:

`validateReportContent(content, context) -> { status, content, issues }`

`context` includes the report profile ID, the immutable document scope, and a batched source resolver that returns only rows already authorized for that profile. The pure core validates JSON shape, source relationships, and claim support against that server-authorized catalog; EH-148 then hands the sanitized result to `public.create_validated_report`, whose database checks are the authoritative final identity/scope guard. Callers cannot pass an arbitrary cross-profile source catalog as proof.

### 2. Validate four boundaries

The validator checks:

1. **Schema:** version, required sections, claim IDs, source IDs, citation shape, and allowed source kinds.
2. **Identity:** every source resolves to the claimed database row and profile; document ID matches the source row.
3. **Scope:** every cited document is in the persisted report scope; no null/implicit all-documents scope is accepted for a new report.
4. **Publication policy:** supported factual claims have at least one valid citation; unknown, broken, or cross-profile references cannot remain publishable.

A source that was later archived may retain its historical snapshot for an owner report, but a live document link or raw download is denied. The validator records the source-unavailable limitation rather than widening authorization.

### 3. Sanitize unsupported claims deterministically

A claim with no citation, an unknown citation, or a failed scope/identity check is removed from the publishable claim list and replaced by one machine-generated limitation with an issue code. The original model text is not copied into the limitation. Non-factual patient questions may survive without citations when their `factual` flag is false. If sanitization removes an entire required section, validation fails closed.

The result statuses are `valid`, `limited`, and `invalid`. `limited` is publishable only when all remaining factual claims are valid and the limitations are visible. `invalid` cannot be persisted as a shareable/exportable report.

### 4. Keep issue codes stable and non-sensitive

Issue codes include `SCHEMA_INVALID`, `SOURCE_NOT_FOUND`, `PROFILE_MISMATCH`, `DOCUMENT_OUT_OF_SCOPE`, `SOURCE_KIND_NOT_ALLOWED`, `CLAIM_UNCITED`, and `SOURCE_UNAVAILABLE`. Logs contain codes and internal request IDs only; source text, token material, and health values are excluded.

### 5. Integrate through EH-148's generation boundary

EH-150 owns the pure validator and its fixtures. EH-148 owns the service-only `createValidatedReport` transition and the `public.create_validated_report` RPC in the report-persistence migration: it runs EH-150 against the server-authorized catalog, then the `SECURITY DEFINER` RPC rechecks profile ownership, source-row identity, scope, and mappings while atomically writing the report and validator status. Any RPC or persistence failure rolls back. EH-151 and EH-153 call the validator/read-only status check before public access or serialization; they do not bypass it or parse `reports.content` ad hoc.

## Risks / Trade-offs

- Database lookups add latency at generation. Batch source resolution by source IDs and document IDs; do not make one query per claim.
- A source can be deleted after validation. Persist the snapshot, re-check authorization for links/downloads, and expose the limitation.
- Sanitization can remove useful model prose. That is safer than publishing an uncited health claim; the limitation tells the user why content is absent.
- A valid citation does not prove clinical correctness. Documentation and UI copy must not overstate the validator's guarantee.
