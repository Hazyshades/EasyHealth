## 1. Registry 2.0 panel domain

- [x] 1.1 Add immutable panel keys, definitions, member roles, ordered member records, and read-only lookup helpers under `src/lib/biomarkers/`.
- [x] 1.2 Add pure panel-registry validation for stable keys, unique normalized names, reviewed concrete member references, unique members, positive unique display orders, and non-empty published panels.
- [x] 1.3 Curate the required and optional CBC, lipid, thyroid, liver, and kidney memberships exclusively from reviewed Registry 2.0 concrete definitions; record any shared members explicitly.
- [x] 1.4 Establish clinically reviewed concrete Registry 2.0 iron-study definitions, including complete identity axes, unit policies, aliases, maturity, and assessment-binding disposition; do not introduce Registry v1 runtime coupling.
- [x] 1.5 Curate and publish the non-empty iron-studies panel from those reviewed Registry 2.0 definitions.
- [x] 1.6 Export the panel registry through the existing biomarker public boundary without adding database, extraction, resolver, or assessment consumers.

## 2. Release governance and regression evidence

- [x] 2.1 Extend canonical Registry 2.0 manifest serialization and digest coverage with a stable panel projection; bump the catalog release version without changing resolver behavior solely for panel data.
- [x] 2.2 Update candidate-release inputs and approval evidence so the changed candidate-input hash fails closed until renewed approvals are recorded.
- [x] 2.3 Add deterministic panel fixtures and a focused verification runner for all six panel rosters, roles, ordering, aliases, reviewed-member validation, and many-to-many membership.
- [x] 2.4 Add regression assertions proving panel membership cannot alter resolver output, specimen evidence, assessment bindings, score roles, readiness/contribution groups, or Health Profile eligibility.
- [x] 2.5 Add negative fixtures for Registry v1 member keys, unreviewed definitions, duplicate member keys, duplicate display order, and invalid panel aliases.

## 3. Documentation and QA

- [x] 3.1 Extend the biomarker documentation generator, checked baseline, and canonical documentation to publish the released panel registry and its ordered memberships.
- [x] 3.2 Regenerate the canonical docs, then regenerate the non-authoritative wiki mirror from those canonical artifacts.
- [x] 3.3 Create `QA/eh-125/checklist.md` with safe tester preconditions and an explicit “Not manually testable yet” section; request deterministic registry, documentation, manifest, and approval evidence rather than claiming unavailable UI coverage.

## 4. Verification

- [x] 4.1 Run the focused panel-registry runner and `pnpm test:measurement-registry`.
- [x] 4.2 Run `pnpm check:biomarker-docs`, `pnpm test:biomarker-docs`, `pnpm check:registry-v2-candidate-corpus`, and `pnpm verify:registry`.
- [ ] 4.3 Run `pnpm typecheck` and `pnpm build`.
- [ ] 4.4 Validate this OpenSpec change strictly and record the renewed candidate-release approval evidence bound to its final input hash.