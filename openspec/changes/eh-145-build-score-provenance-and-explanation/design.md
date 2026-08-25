## Context

The Health Profile currently builds a deterministic `HealthProfileResult` in `src/lib/health-systems.ts`. `projectHealthProfileLaboratoryInput` admits only Registry-v2 assessment inputs, `computeSystemStateScore` selects one usable marker per contribution group, and `HealthProfileDrawer` displays factual markers and missing readiness groups. The snapshot query already reads the immutable assessment payload and document metadata, while observation rows retain source page, source text, and validated `bounding_box` provenance in the database.

The missing seam is explainability: the projection drops observations that fail assessment admission, the score helper does not expose its selected markers, and the drawer does not show all readiness groups, algorithm identity, contribution values, or exclusion reasons. EH-145 must explain the existing score without changing its clinical or catalog policy.

## Goals / Non-Goals

**Goals:**

- Produce a deterministic, additive score-provenance payload for every generated Health Profile assessment.
- Use the exact same readiness and contribution selection functions for scoring and explanation so the explanation cannot drift from the displayed score.
- Preserve source document id, page, snippet, and validated source-region evidence for contributors and excluded observations.
- Retain machine-readable exclusion reasons for admitted-but-non-contributing markers and for observations rejected before Health Profile projection.
- Render an accessible expandable explanation in the body-system drawer and a profile-level excluded-observation list for rows without a rendered system.
- Keep the algorithm identity explicit and bumpable when score selection semantics change.
- Keep old factual score/readiness fields and source navigation behavior intact.

**Non-Goals:**

- No change to score formulas, thresholds, required groups, contribution-group policy, freshness policy, assessment eligibility, Registry definitions, aliases, or bindings.
- No diagnosis, disease-risk label, clinician recommendation, or new AI-generated explanation.
- No new database table, migration, endpoint, or source-document signed-URL flow.
- No rendering of fuzzy, ambiguous, unresolved, cross-page, or invalid rectangles as exact visual evidence; those remain page-only provenance with a document link.
- No backfill or mutation of append-only historical assessment versions.

## Decisions

### 1. Additive typed provenance beside existing score fields

Add `HEALTH_PROFILE_SCORE_ALGORITHM_VERSION = "eh145-score-v1"` and typed provenance fields to `HealthProfileResult` and `SystemInsight`:

- `score_algorithm_version` identifies the scoring contract at the profile level.
- Each system carries `score_provenance` with the algorithm version, every readiness group, selected `contributors`, and `excluded` observations.
- The profile carries `score_provenance.excluded_observations` as the complete exclusion list, including rows that cannot be associated with a rendered system.

An explanation item includes a stable observation id when available, assessment key, measurement-definition key, value/unit, status, observed date, source document metadata, source page/text, and parsed source region. The reason is a stable machine code; optional detail is limited to existing non-PII outcome/reason metadata.

Alternative rejected: reconstructing explanations in the React client from marker names or readiness arrays. That would omit pre-projection exclusions and could disagree with the server score.

### 2. Share selection helpers with scoring

Extract the contribution-group selection used by `computeSystemStateScore` into a shared deterministic helper. It returns the first usable marker in each catalog-ordered group. The score maps the selected markers to `markerStateScore`; the provenance maps the same selections to contributor records and group ids.

For a scoreable system, every other marker receives one reason: non-numeric, missing reference range, specimen mismatch, non-core/supporting, duplicate contribution group, or not in a contribution group. For an incomplete or non-scoreable system, structurally invalid markers retain their specific reason and otherwise usable candidates are marked `score_not_available` or `system_not_scoreable`. This makes a null score explainable without pretending any marker contributed.

Alternative rejected: store only the final numeric score and a free-form sentence. It cannot prove group de-duplication or distinguish missing evidence from excluded evidence.

### 3. Preserve pre-projection exclusions in the snapshot builder

Extend the Health Profile snapshot observation query with the observation id, source fields, analyte identity, and active normalization revision data needed by the existing `projectLaboratoryOutcome` eligibility contract. For each laboratory row that is not projected into `HealthProfileLaboratoryInput`, create a score-exclusion item using the existing assessment exclusion reason and incomplete-resolution detail. Resolve a known reviewed binding to its system when possible; otherwise use `general`/unassigned while retaining the raw observation identity and source link.

Projected inputs receive their observation id and validated source metadata after the existing admission function returns. This keeps the current projection deep-equality contract unchanged for callers that do not provide provenance fields, while making queued and request-time snapshots identical.

Source-region JSON is parsed with `parseSourceRegion` and kept only when page-coherent. The panel always links to the document; it labels a rectangle as exact only when `sourceRegionCanRender` passes. Page-only/fuzzy evidence never becomes a stronger visual claim.

### 4. Persist through the existing immutable payload

The worker already calls `buildHealthProfileSnapshot` and writes its `profile` JSON through `complete_assessment_recalculation_job`. No schema migration is needed: the new fields are additive JSON payload members and are included in the existing input hash because source/provenance fields are part of the canonical snapshot inputs. The API returns the cached payload unchanged and keeps the current job/version metadata.

Legacy cached payloads without provenance remain readable; the client hides the new panel until a newly generated payload is available rather than inventing evidence.

### 5. Use one reusable expandable evidence component

Create a client component that renders:

- algorithm version and score/readiness summary;
- all readiness groups with satisfied, missing, or present-without-reference state;
- contributor cards with contribution-group id, computed contribution value, lab range, source page/snippet, exact/page-only indicator, and a link to `/app/documents/:id?page=<source_page>` with existing return/system/measurement context;
- excluded cards with a human label for the stable reason code, the original value/source context, and the same document link.

The body-system drawer embeds the component in a native `<details>` section. The profile page embeds its exclusion-list mode for global rows not reachable through a selected system. Empty states say that no observations contributed rather than displaying a false score explanation.

### 6. Verify behavior with deterministic fixtures

Add `scripts/verify-eh145-score-provenance.ts` and the `test:eh145` package script. Pure fixtures assert that readiness groups are complete, one marker per contribution group is selected, alternates are excluded with a stable reason, source page/text/region survive projection, external pre-projection exclusions remain visible, and the algorithm version is present. Existing Health Profile and document source-region checks remain the regression suite for their contracts.

## Risks / Trade-offs

- **Historical cached payloads lack provenance.** The API remains backward compatible, but the explanation panel is unavailable until the assessment worker generates a new version; the existing recalculation/retry path is the safe refresh mechanism.
- **Exclusion lists can be long.** They are behind native expandable sections and retain every row for traceability rather than truncating evidence.
- **Source snippets can contain sensitive document text.** Only already-persisted row-level source snippets are projected; resolver traces and logs remain redacted, and the UI prefers the existing document link/page fallback.
- **A known binding may be absent for an excluded row.** Such rows are shown as unassigned/general with their exact machine reason instead of guessing a body system.
- **Adding provenance increases snapshot payload size.** The payload is bounded by the existing per-profile observation set and avoids additional database round trips or duplicated raw documents.
