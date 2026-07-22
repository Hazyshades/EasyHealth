## Context

The existing Health Profile aggregates completed lab documents into body-system coverage percentages and shows marker details inline. The desired experience is closer to a health index: a user clicks a score on the body map and sees a side drawer explaining which uploaded data contributed to that system or organ. The MVP must stay within EasyHealth's educational safety rules and the existing pay-per-insight model.

The current data source is deterministic: `observations` rows joined to completed `documents`. Reports already provide paid LLM narrative, so this change must not introduce a free LLM summary during upload or profile viewing.

## Goals / Non-Goals

**Goals:**
- Present each mapped system/organ with a 0-100 "current state assessment" score rather than data coverage.
- Preserve a separate data confidence value so users can see how complete the evidence is.
- Open a side drawer when the user selects a score, showing factual data cards and source document links.
- Explain "why highlighted" using neutral facts derived from out-of-range markers and document metadata.
- Show a paid "Generate report to see insights" CTA where narrative insights would appear.
- Keep profile aggregation deterministic and fresh after new completed documents are uploaded.

**Non-Goals:**
- No free compact LLM profile summary.
- No diagnosis, treatment recommendation, disease-risk conclusion, or clinical risk score in the free profile drawer.
- No new screening questionnaire ingestion such as PHQ-9 or SCORE2 in this change.
- No DICOM, genetic, wearable, family-profile, or doctor-portal expansion.
- No automatic paid report generation after upload.

## Decisions

### Deterministic score and confidence

System/organ badges will display a 0-100 current state assessment score. The score is computed from the latest biomarker observations mapped to that system:

- in-range markers contribute a high score
- out-of-range markers reduce the score according to a bounded deterministic formula
- markers without a reference range contribute a neutral score
- systems with no mapped markers are omitted

Data confidence remains separate and is based on expected marker coverage, source recency, and whether reference ranges are available. This avoids making the score carry both "state" and "data completeness" semantics.

Alternative considered: keep the existing coverage percentage as the visible badge. This was rejected because the target UX needs a health-index style interaction, while coverage can be preserved as confidence.

### Factual drawer first

Clicking a badge opens a right-side drawer rather than replacing the map or relying on the existing narrow inline panel. The drawer includes:

- title and selected system/organ label
- current state assessment score
- data confidence percentage
- why highlighted facts, prioritizing out-of-range markers
- data cards with marker value, unit, reference range status, observed date, and source document
- paid report CTA for narrative insights
- standard medical disclaimer or short educational safety copy

Alternative considered: show narrative hypotheses and recommendations directly in the drawer. This was rejected for the MVP because those sections require LLM generation and should remain behind the paid report flow.

### Source document selection

Each marker already stores `document_id`. The API will return enough document metadata for drawer data cards. The drawer can mark a primary source for the selected system by choosing the completed document with the highest count of contributing markers, prioritizing out-of-range markers when present.

Alternative considered: ask the LLM to choose the source. This was rejected because source attribution should be deterministic and auditable.

### Paid insights CTA

The drawer's narrative insight area will show a CTA linking to the existing create-report flow. Copy should be explicit that factual data is shown for free and deeper AI insights require generating a paid report.

Alternative considered: generate a free compact summary once after the first upload. This was rejected because it adds unpaid LLM cost, stale-summary complexity, and weakens the current pay-per-insight model.

## Risks / Trade-offs

- Health-index scores can be misunderstood as diagnosis or disease risk -> Mitigate with "Current state assessment", "Data confidence", source citations, neutral marker language, and the standard disclaimer.
- Deterministic scoring may feel less clinically rich than Lissa-style narrative -> Mitigate by making the drawer useful with source documents and by offering paid reports for narrative.
- API response changes may affect existing profile components -> Mitigate by updating types and UI together, and by keeping source lists and records-used fields available.
- Some organs such as lungs or brain have weak support from lab-only data -> Mitigate by initially showing only systems/organs with mapped evidence and avoiding unsupported conclusions.
- New score formulas may need tuning -> Mitigate by keeping scoring constants local, bounded, and easy to adjust without schema migrations.

## Migration Plan

No database migration is required. Deployment updates the deterministic aggregation code, the health-profile API response, and the profile UI together.

Rollback is a code rollback to the existing coverage-based body map. Since no persisted data shape changes are introduced, rollback does not require data migration.

## Open Questions

- Which initial organ labels should be exposed beyond the existing system labels: Heart only, or also Liver, Kidney, Thyroid, Blood, Metabolic, and Nutrients?
- Should score thresholds use color labels only, or also text labels such as "Stable", "Needs attention", and "Limited data"?
- Should the paid CTA deep-link to `/app/reports/create` with preselected documents once document selection URL state exists, or link to the create page without preselection for this MVP?
