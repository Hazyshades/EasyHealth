## Context

The current Health Profile projection is built by `buildHealthProfileSnapshot` from profile-owned observations and completed/ready documents. `buildHealthProfile` reports `onboarding`, `no_recognized_biomarkers`, or `body_map`; it does not know how many current extracted laboratory rows were preserved when no observation passes the Registry/assessment boundary. The profile page therefore falls back to the same upload-oriented empty state for a processed report whose rows were safely rejected or are still incomplete. The dashboard also turns the profile response into `null` when `records_used_count` is zero, which hides that distinction.

The document review API and `incomplete-laboratory-outcomes` projection already preserve raw labels, values, units, reference ranges, provenance, and safe resolution reasons. The change should reuse that contract rather than create a second candidate or raw-value model. The existing `projectLaboratoryOutcome` and `projectHealthProfileLaboratoryInput` functions are the sources of truth for resolution and assessment eligibility.

The papercut ledger also records three regressions with user-visible consequences. EH-122 now evaluates `DocumentViewer` hooks before loading/error returns and initializes `batch_verification_operations.aggregate_status` to `executing` before row processing. EH-144 now presents a semantic unknown-date state instead of treating it as outdated; the earlier drawer copy could render the date-unavailable wording twice. These fixes must become explicit regression contracts, not new behavior that bypasses the existing safety boundaries.

Section-heading capture and reviewed panel specimen policies already have a dedicated OpenSpec change, `add-reviewed-panel-specimen-policy`, tracked by #111. This change depends on that work where section context is needed, but does not copy its catalog entity, approval scope, or specimen inference rules. #127 is the matching product issue for the reported-results fallback and is reused rather than duplicated.

## Goals / Non-Goals

**Goals:**

- Expose one authenticated, server-computed reported-results summary to both Health Profile and the dashboard.
- Distinguish no document, document processing, reported-but-not-scoreable, and score-available states.
- Keep unresolved raw values reviewable with factual reasons and source navigation while preserving the existing exclusion boundary.
- Make the extraction prompt-to-persistence seam checkable, including the rule that section context is captured verbatim or remains absent; never promote a guessed axis.
- Keep the EH-122 hook-order and batch-initialization invariants regression-tested.
- Keep unknown-date copy singular and factual.
- Avoid a database migration by projecting from current extracted rows, observations, normalization revisions, and document status.

**Non-Goals:**

- Changing score formulas, readiness groups, freshness policy, Registry aliases, or assessment bindings.
- Inferring specimen, method, unit, timing, value kind, or reference ranges from analyte names, panel names, prevalence, or instrument names.
- Implementing the reviewed panel specimen catalog or section-heading extraction owned by #111.
- Adding row-level correction, a candidate picker, or a direct path from a raw value to a score.
- Returning raw laboratory values from a new broad profile endpoint; raw rows remain on the authenticated document review surface.
- Providing diagnosis, disease-risk, test-ordering, or repeat-testing advice.

## Decisions

### 1. Add a single server-side reported-results projection

Extend the health-profile result contract with a `reported_results` object and add `reported_but_not_scoreable` to `ProfileDisplayState`; retain all existing states. The summary is computed in `buildHealthProfileSnapshot` and serialized by `GET /api/health-profile`, so the profile page and dashboard cannot disagree about counts.

The summary contains stable counts:

- `reported_count`: current active extracted laboratory rows with a raw numeric or text result on profile-owned processed documents;
- `ready_for_scoring_count`: those rows represented by an admitted assessment-eligible laboratory input;
- `needs_document_details_count`: rows whose safe outcome is blocked by a missing or conflicting document axis, such as `axis_not_stated` or `unit_or_value_conflict`;
- `awaiting_catalog_review_count`: rows with `no_candidate` or `definition_not_reviewed`, including unresolved preview rows;
- `awaiting_verification_count`: rows with a concrete reviewed identity that remain excluded only because verification is required;
- `source_document_count`: distinct processed documents contributing reported rows.

The builder must keep the counts deterministic and non-negative. Rows that do not fit an incomplete-resolution bucket are classified by the existing eligibility exclusion (for example, verification or currentness) rather than silently dropped. `ready_for_scoring_count` is an admission count, not a claim that a complete named-system score exists.

The snapshot query should load current extracted rows only for the already-selected profile-owned processed documents and include their stable ids. It should correlate rows to observations through the existing source-extracted relationship, then reuse `projectLaboratoryOutcome` for safe reason classification and `projectHealthProfileLaboratoryInput` for the ready count. No resolver logic is reimplemented in the UI.

### 2. Use state precedence that preserves mixed coverage

Use the following projection precedence:

1. no profile-owned processed documents and no reported rows: `onboarding`;
2. processed documents with no reported laboratory rows: `no_recognized_biomarkers`;
3. at least one reported row and zero ready rows: `reported_but_not_scoreable`;
4. otherwise: `body_map`.

When `body_map` is shown with unresolved rows, render a compact reported-results notice above the body map. When `reported_but_not_scoreable` is shown, render the dedicated notice instead of presenting an empty body map as the only feedback. Existing system score/readiness output remains present when there are normalized observations, including mixed resolved/unresolved documents.

The profile summary is not used to change `state_score`, `scoreability`, `score_readiness`, freshness, or source selection. It is explanatory projection data only.

### 3. Reuse the document review surface for raw evidence

The new notice links to the authenticated documents hub (`/app/documents`), where the existing document viewer renders the same raw-evidence block and per-row explanation required by `incomplete-laboratory-outcomes`. It does not duplicate patient-linked raw rows into a profile-wide list or expose candidate keys as confirmed identity.

The notice copy is fixed and non-clinical. It includes the reported count and ready count, shows the two actionable unresolved buckets, and offers `Review results` plus `Upload a clearer report`. The latter is an optional source-quality action; it must not say to order, repeat, or obtain a medical test. The dashboard uses the same summary and must not show `Upload your lab` when a processed document already contains reported rows.

### 4. Make extraction evidence a typed seam

Keep the extraction output and worker persistence mapping aligned around the existing provenance fields. The implementation should make the section-context field explicit in the pipeline row type and its insert mapper, then add a pure seam assertion that a supplied verbatim heading survives parsing and mapping while an absent heading remains `null`. The assertion must also verify that the stated-axis filter does not accept a specimen solely because a prompt or section heading names it.

This is a persistence contract, not a new inference rule. `add-reviewed-panel-specimen-policy` owns the future reviewed policy that may consume captured section context. Until that change is applied, a row without document-native specimen evidence remains incomplete.

### 5. Turn the historical runtime fixes into regression gates

Extend the existing document-review and drawer verification rather than adding a parallel test framework:

- verify that all `DocumentViewer` hooks used for batch selection, history, and review rows are declared before the loading/error returns and that the loading-to-loaded transition has no Rules of Hooks violation;
- retain the EH-122 service assertion that `aggregate_status: "executing"` is inserted before row processing, and add a failure-path assertion that no row mutation is accepted when operation initialization fails;
- render an unknown-date drawer fixture and assert one semantic freshness label plus one factual explanation, with no duplicate date-unavailable copy;
- add the prompt/persistence seam assertion to the existing document/resolver verification path and ensure every newly added verification script is registered by the CI suite-coverage policy.

The implementation may use the repository's current static/`renderToStaticMarkup` verifier conventions. It must not claim browser or database coverage when the required environment is unavailable.

### 6. Keep rollout and privacy boundaries boring

The summary is read-only and derived on every request or queued snapshot build; it is not persisted as a new clinical fact. Existing profile ownership checks and authenticated document links remain the authorization boundary. The implementation should ship the pure summary projection first, then UI branches, then regression assertions, so a failed UI branch cannot change resolver admission.

Because the change alters the public meaning of Health Profile laboratory coverage and consumes Registry resolution outcomes, implementation completion must run the repository Registry documentation synchronization gate. Canonical docs, generated docs, Wiki status, and one tracking issue must describe implemented versus deferred panel-policy behavior accurately.

## Risks / Trade-offs

- **Extra snapshot query cost:** Loading current extracted rows adds a bounded profile-scoped query. Mitigate with one projection query, current-row filters, and no per-row network calls.
- **Count drift:** Extracted rows and observations have different lineage and lifecycle rules. Correlating through stable source-extracted ids and using the existing outcome/eligibility helpers avoids a second interpretation of resolver state; tests must cover zero, mixed, and all-ready sets.
- **Ambiguous user wording:** A concise count can be mistaken for a score. The UI must label `ready for Health Profile scoring` explicitly and keep the medical disclaimer and unresolved exclusion explanation visible.
- **Existing unresolved rows remain unresolved:** This change improves visibility, not catalog coverage. #111 remains the reviewed panel-context recovery path, and #127 remains the matching product issue for this fallback experience.
- **Historical fixes may already be present:** Regression tests must accept the current corrected implementation and fail only if the hook, batch initialization, or freshness-copy invariant regresses; no duplicate runtime fix should be added.
- **Generated documentation drift:** Registry-facing implementation changes require the canonical-doc generator, drift check, contract tests, Wiki staging/publication status, and tracking issue before completion.
