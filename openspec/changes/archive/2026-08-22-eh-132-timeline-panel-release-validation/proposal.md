## Why

EH-125, EH-126, and EH-127 provide independent panel, precision-safe event, and Health Timeline contracts, while the existing Biomarkers surface provides part of the EH-129 comparison path. EH-132 is the P0 beta-release gate that must prove those boundaries together with reproducible fixtures; isolated feature checks do not establish that event chronology, partial dates, multi-laboratory compatibility, duplicate handling, and panel membership remain safe at release volume.

## What Changes

- Add a deterministic EH-132 release-validation fixture matrix spanning supported timeline event types, known/unknown and partial medical dates, explicit timezone instants, multi-laboratory measurement rows, compatible and incompatible units/definitions, and all curated panel memberships.
- Add focused automated checks for ascending/descending event ordering, no upload-date substitution, date precision/timezone preservation, current-row and duplicate handling, exact-definition comparison eligibility, unit/reference-range/source preservation, and many-to-many panel membership.
- Add a bounded synthetic performance check for the pure timeline projection at a documented fixture volume, plus a profile-document page collector so the authenticated route never truncates a release-volume timeline at the backend row cap. The checks report measured evidence without pretending that an unspecified production SLA exists.
- Preserve a specimen explicitly printed in an extracted row's captured source snippet when the model omits its structured specimen field; it remains evidence-bound and does not infer missing clinical axes.
- Expose the validation through package scripts, including a transactional database contract check for event/date uniqueness, idempotent writes, profile isolation, and partial/instant date constraints where the local Supabase stack is available.
- Add `QA/eh-132/checklist.md` as the release-gate record. It will separate tester-executable Health Timeline/Biomarkers checks from developer evidence, record P0 defects and performance evidence, and mark unavailable panel/comparison UI or missing authenticated environments as Blocked rather than passed.
- Do not add panel data, a new timeline/comparison product surface, a new persistence model, or a speculative EH-129 feature. This change validates and documents existing contracts only.

## Capabilities

### New Capabilities

- `timeline-panel-release-validation`: Reproducible cross-feature release evidence for chronological events, precision-safe dates, compatible repeated measurements, panel membership, duplicate boundaries, performance, and product sign-off.

### Modified Capabilities

## Impact

- **Target domains:** `documents` (medical-event projection, Health Timeline, and evidence-bound laboratory extraction), `health-profile` (laboratory comparison and panel consumers), and release QA evidence.
- **Affected files:** EH-132 fixture/verification scripts, Health Timeline document collection, extraction provenance handling, generated Registry documentation, package scripts, a transactional database fixture, OpenSpec artifacts, and `QA/eh-132/checklist.md`.
- **Dependencies:** EH-125, EH-126, EH-127, and the available EH-129 comparison contracts. Full EH-129 UI/date-selector delivery and product sign-off remain explicit release-gate evidence, not assumptions.
- **Runtime/data compatibility:** no production schema or data migration is planned. The parser promotes only a specimen that lexical source evidence already states; all database checks run transactionally against synthetic rows and roll back.
