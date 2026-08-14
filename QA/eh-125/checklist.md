# EH-125: Static panel registry and membership

**Roadmap status:** In progress
**Build / environment:** `________`
**Test run date:** `________`
**Tester:** `________`

## What this checklist covers

EH-125 adds static Registry 2.0 metadata for CBC, lipid, thyroid, liver, kidney, and iron-studies panels. A panel groups reviewed concrete measurement definitions for future consumers; it does not change what a document says, identify an unlabelled laboratory result, infer specimen, or change Health Profile scoring.

## Before you start

- [ ] Use a dedicated test account if a later build exposes a panel interface.
- [ ] Use only synthetic or de-identified documents.
- [ ] Do not treat a document section heading as proof that a row belongs to a panel or has a specimen.

## Test data

| ID | Test document or setup | Purpose |
| --- | --- | --- |
| `EH125-REGISTRY-01` | The checked-in static Registry 2.0 catalog and panel-registry verification runner. | Verify the six curated panels and their ordered memberships. |
| `EH125-REGISTRY-02` | A synthetic resolved hemoglobin row already covered by Registry fixtures. | Verify that CBC and iron-studies membership does not alter clinical interpretation. |

## Interface checks

## Not manually testable yet

EH-125 does not add a screen, route, export, document-review control, or timeline view. Do not mark an interface check as passed for this change. A future consumer must add its own tester-facing checks when it displays panel membership.

## Developer evidence required

- [ ] Engineering provides `pnpm test:panel-registry` output proving exactly six non-empty panels, reviewed concrete members, deterministic order, alias validation, and many-to-many membership.
- [ ] Engineering provides `pnpm test:measurement-registry` output proving Registry 2.0 validation still passes.
- [ ] Engineering provides regression output proving panel lookup does not change resolver output, score role, readiness groups, or contribution groups.
- [ ] Engineering provides `pnpm check:biomarker-docs` and `pnpm test:biomarker-docs` output proving canonical generated documentation matches the runtime registry.
- [ ] Release management provides the technical candidate report for candidate-input hash `55939ab965139d3fe25c78b875201e048e33d7729b6bdb90b690335b7b746eed` and records renewal of every required approval before release.
- [ ] Documentation owner publishes the reviewed generated Wiki staging output or records the remote publication handoff on issue #25.
- [x] Database regression test is not applicable: EH-125 changes only static TypeScript catalog data, manifest serialization, fixtures, and generated documentation. It adds no migration, database read/write/projection, RPC, authorization, or persistence contract.

## Out of scope or not manually testable yet

- Panel membership does not identify measurements, supply specimen, change a resolver outcome, or alter Health Profile eligibility or scoring.
- OCR-backed panel-to-specimen policy is deferred to the separate reviewed panel-specimen-policy change.
- Timeline ordering and panel presentation are deferred to EH-126 and later panel consumers.
- The current generated Wiki mirror is local staging evidence only until publication to the GitHub Wiki is confirmed.
