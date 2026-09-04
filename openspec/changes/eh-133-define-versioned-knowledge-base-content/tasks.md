## 1. EH-134 Baseline and Shared Contract

- [x] 1.1 Make merge of EH-134 PR #224 and rebase of this change the apply prerequisite; do not implement against a checkout that lacks `src/lib/knowledge-base/`.
- [x] 1.2 Preserve the EH-134 measurement field names and states: `type`, `measurementDefinitionKey`, `slug`, `locale`, `contentVersion`, `reviewStatus`, review/deprecation metadata, typed education sections, sources, and `relatedMeasurementKeys`.
- [x] 1.3 Add the shared strict article envelope and panel discriminator/subject boundary in the existing Knowledge Base module without adding aliases or a second schema.
- [x] 1.4 Keep version-controlled article records in typed catalog modules; leave the production catalog empty until a reviewed content change supplies records.

## 2. Catalog Loading and Semantic Validation

- [x] 2.1 Add deterministic catalog indexing with unique `type + locale + slug` identities and exact-locale lookup; do not introduce a JSON/Markdown filesystem loader, CMS, database table, or content API.
- [x] 2.2 Add published-only projections for measurement and panel records; draft, in-review, and deprecated records must never be returned as current published education.
- [x] 2.3 Validate primary measurement subjects against active reviewed Registry 2.0 definitions and panel subjects against the static Panel Registry.
- [x] 2.4 Preserve curated related measurement keys while withholding links for missing, unpublished, or unresolved related articles instead of guessing routes from raw keys.
- [x] 2.5 Enforce strict source, review, lifecycle, deprecation, slug, locale, version, duplicate-identity, and unsupported-field rules without copying Registry or assessment fields into article records.
- [x] 2.6 Keep all general article loaders independent from profile, observation, document, patient-value, source-evidence, resolver, and scoring inputs.

## 3. Focused Contract Verification

- [x] 3.1 Add synthetic contract fixtures for measurement and panel discriminators, valid and invalid Registry subjects, exact locales, lifecycle states, HTTPS sources, review metadata, deprecation timestamps, and duplicate identities.
- [x] 3.2 Add negative assertions for unsupported private/assessment fields, unsafe sources, invalid lifecycle combinations, provisional or retired primary subjects, and invalid panel/measurement discriminators.
- [x] 3.3 Verify published filtering, deterministic ordering, empty-catalog behavior, and safe withholding of unresolved related links; keep `pnpm test:eh134` passing.
- [x] 3.4 Add a focused `test:eh133` command and wire it into the applicable workflow without changing Registry, scoring, database, or generated biomarker-documentation behavior.

## 4. QA and Completion Evidence

- [x] 4.1 Create or update `QA/eh-133/checklist.md`; mark article UI and private-results flows unavailable until EH-136 provides reviewed content and authenticated fixtures.
- [x] 4.2 Review canonical Registry documentation and Wiki outputs as a consumer-only read; record unchanged docs or any required documentation-sync status rather than inventing Registry changes.
- [x] 4.3 Run focused EH-133/EH-134 verification, applicable type checks, OpenSpec validation, and required documentation checks; record database regression coverage as not applicable.
- [x] 4.4 Before downstream EH-135/EH-136/EH-139 merges, migrate their local article shapes through this shared contract or one explicit adapter; do not merge competing lifecycle/storage schemas.
