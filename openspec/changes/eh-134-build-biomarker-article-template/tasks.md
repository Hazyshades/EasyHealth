## 1. Knowledge Base content boundary

- [x] 1.1 Add the typed measurement article contract, review/deprecation statuses, source metadata, required educational sections, and publication validation rules.
- [x] 1.2 Add the version-controlled article catalog lookup plus a Registry-derived measurement view-model helper for aliases, accepted units, specimen, panel membership, and safely resolved related article links.

## 2. Measurement article experience

- [x] 2.1 Build the reusable authenticated measurement article renderer with the required education sections, visible review/source metadata, fixed disclaimer, responsive layout, and no-range/no-diagnosis boundary.
- [x] 2.2 Add `/app/knowledge/measurements/[slug]` route metadata and not-found gating so only valid published articles render.
- [x] 2.3 Add the profile-scoped **Your results** island: load `/api/biomarkers`, filter exact definition matches, render loading/error/empty states, and link owned source documents and Biomarkers context safely.

## 3. Verification and delivery evidence

- [x] 3.1 Add deterministic EH-134 contract verification for publication gating, Registry projection, related-link safety, observation filtering, and navigation boundaries; expose it as `pnpm test:eh134`.
- [x] 3.2 Create `QA/eh-134/checklist.md` with synthetic interface flows, developer evidence requirements, and the explicit EH-136 content availability limitation.
- [x] 3.3 Run focused EH-134 verification and typecheck, then record the observed results in the QA checklist without marking unavailable UI as passed.
