## Why

EH-134 (PR #224, branch `eh-134`) already introduced the first Knowledge Base boundary: a typed, Zod-validated measurement article record, an intentionally empty version-controlled article catalog, Registry-backed publication gating, and a published-only reader used by the measurement article route. EH-133 must build on that reviewed contract rather than introduce a second JSON/Markdown content model. Without a shared contract, the later panel, article, index, and publication changes will drift into incompatible field names and lifecycle rules.

The EH-133 change therefore completes the version-controlled Knowledge Base contract around the EH-134 measurement shape, reserves the same boundary for panel content, and makes lifecycle, provenance, subject references, deprecation, and private-data separation explicit before downstream content is added.

## What Changes

- Treat the EH-134 `src/lib/knowledge-base` measurement contract as the canonical starting point; preserve its field names and publication states (`draft`, `in_review`, `published`, `deprecated`).
- Define the shared article identity and editorial metadata contract: `type`, `slug`, `locale`, `contentVersion`, title/summary, review status, reviewer metadata, sources, related measurement-definition keys, and deprecation metadata.
- Extend the same typed boundary with a panel article discriminator and panel subject reference without coupling EH-133 to a panel page or panel-specific copy layout; EH-135 owns that presentation.
- Keep article records in version-controlled TypeScript catalog modules, as EH-134 does. Do not add a parallel filesystem loader, JSON/Markdown pair format, database table, CMS, or runtime content API.
- Add shared deterministic lookup and validation rules: exact-locale resolution, unique type/locale/slug identity, reviewed active Registry subject checks, published-only projections, and fail-closed handling of malformed records.
- Define the deprecation policy around `deprecatedAt` and optional `replacementSlug`; deprecated records are excluded from current published readers and never silently redirected by this schema-only boundary.
- Keep Registry display names, aliases, units, specimen, panel membership, assessment bindings, ranges, scoring, observations, source documents, and user values owned by their existing boundaries.
- Keep general educational content independent from authenticated profile data. Future **Your results** sections must use the existing profile-scoped read paths separately.

## Capabilities

### New Capabilities

- `knowledge-base-content`: the shared, version-controlled Knowledge Base article contract, typed catalogs, subject references, review lifecycle, source provenance, exact-locale lookup, deprecation handling, and safe separation from private observations.

### Modified Capabilities

- None. Existing Registry, observation, assessment, and Health Profile capabilities remain behaviorally unchanged; EH-133 only consumes their reviewed lookup boundaries.

## Impact

- Extend the existing `src/lib/knowledge-base/` boundary introduced by EH-134 with shared article types, panel-compatible metadata, validation, catalog indexing, and focused contract coverage.
- Downstream EH-135/EH-136/EH-138/EH-139 work must consume this contract or use a single explicit adapter; it must not create another article schema with competing lifecycle or source fields.
- The production catalog remains empty until a separate content change supplies clinically reviewed records; no unreviewed article is introduced by EH-133.
- No database migration, CMS, observation/API contract change, extraction or resolver change, scoring change, Registry catalog change, or generated biomarker documentation change is required.
