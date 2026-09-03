## Why

The repository has no authoritative Knowledge Base publication gate: an article can be represented without a review lifecycle, source evidence, or freshness decision, and there is no public renderer that can guarantee those fields are visible. EH-139 needs a fail-closed, version-controlled governance seam before reviewed health guidance is exposed; it must remain independent of Registry resolution and assessment logic.

## What Changes

- Add a typed, version-controlled Knowledge Base article contract compatible with the EH-133 schema: `draft`, `review`, `published`, and `deprecated` lifecycle states, slug/locale/version metadata, reviewer metadata, sources, body content, and safe deprecation targets.
- Add one publication policy used by both build-time validation and runtime reads. Published articles require a non-blank reviewer, a valid review timestamp, at least one HTTPS source, and a non-stale review; draft and review content is never publicly readable.
- Add a deterministic stale-content report with an explicit review-freshness policy so stale published entries are visible to maintainers and fail the release check rather than silently remaining guidance.
- Add a public Knowledge Base index and article renderer that displays the last reviewed date, source list, and medical disclaimer, and permanently redirects deprecated slugs only to an internal replacement article or the Knowledge Base index.
- Add focused governance verification and run it from the production build preflight. The Knowledge Base remains file-backed and cannot alter observation normalization, scores, or assessment inputs.

## Capabilities

### New Capabilities

- `knowledge-base-publication-governance`: Versioned educational content, fail-closed publication rules, freshness reporting, public metadata rendering, and safe deprecated-page redirects.

### Modified Capabilities

- None.

## Impact

- New Knowledge Base content and policy modules, public Knowledge Base routes/components, and a deterministic validation script.
- `package.json` build preflight and focused verification coverage.
- No database migration, Registry catalog change, assessment behavior change, or private profile data access.
