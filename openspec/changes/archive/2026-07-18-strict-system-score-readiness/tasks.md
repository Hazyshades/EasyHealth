## 1. Catalog score-readiness policy

- [x] 1.1 Add catalog types and deterministic per-named-system `scoreRequiredGroups`, `scoreContributionGroups`, and explicit scoreability registries, keeping `scoreRole` and `coversConfidence` as independent marker policies.
- [x] 1.2 Define and document the initial required groups for scoreable named systems, make inflammation explicitly non-scoreable, retain UACR as a kidney requirement, and reclassify ferritin as extended supporting data.
- [x] 1.3 Add unit tests for required-group satisfaction, alternative keys, non-scoreable systems, contribution-group deduplication, missing observations, and markers present without usable document reference ranges.

## 2. Health-profile aggregation and API contract

- [x] 2.1 Extend health-profile result types with nullable system and overall scores, score-readiness details, `scoreable_named_system_count`, `scoreable_named_system_total`, and a deterministic biomarker-observation count or profile display state.
- [x] 2.2 Replace soft fallback and unknown-reference score paths with strict readiness evaluation; after readiness, average only usable `core` contribution-group scores.
- [x] 2.3 Build all eight named-system placeholders after the first biomarker observation; append General only for General-routed observations and keep it unscored.
- [x] 2.4 Compute the overall assessment from scoreable named systems only, return null until at least three named systems are scoreable, and expose the scoreable-system denominator.
- [x] 2.5 Update the health-profile API serialization and deterministic aggregation tests for nullable scores, readiness detail, empty users, and uploaded/no-recognized-biomarker state.

## 3. Health-profile presentation

- [x] 3.1 Update body-map badges, connectors, list entries, and score formatting so null scores render as interactive muted `—` states rather than zero scores.
- [x] 3.2 Update the system drawer to render No data, incomplete-core, and General supporting/specialty states; show missing groups, present-without-reference required markers, supporting markers, and the upload CTA.
- [x] 3.3 Update the profile page to select onboarding, uploaded/no-recognized-biomarker, and S3 body-map states from the API result.
- [x] 3.4 Add the insufficient-data overall assessment in profile and dashboard card surfaces: allow user-scoped dismissal only on the profile, keep the Dashboard card persistent, restore numeric output when at least three named systems become scoreable, and display the scoreable-system denominator with numeric output.
- [x] 3.5 Preserve factual, non-diagnostic copy and existing source attribution across all new unscored states.

## 4. Verification

- [x] 4.1 Replace soft-fallback expectations in the biomarker verification runner with strict score-readiness and nullable-score fixtures.
- [x] 4.2 Add regression cases for General-only data, inflammation-only data, partial core data, required alternatives, missing references, contribution-group deduplication, and the three-system overall threshold.
- [ ] 4.3 Run the relevant unit/verification suite plus lint and type checks; manually verify desktop and narrow-layout body-map and drawer states.
