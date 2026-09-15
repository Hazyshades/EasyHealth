# EH-248: Resolver evidence identity and admission

- **Roadmap status:** Change A and Change B implementation complete on the dedicated branch; database execution, candidate approval renewal, Wiki publication, and remote PR publication remain pending external gates
- **Build / environment:** `feat/248-historical-persisted-decision-read` — Change B implementation verification
- **Test run date:** `2026-09-15`
**Tester:** `Codex implementation verification`

## What this checklist covers

This checklist covers the Registry 2.0 evidence path used by document review, acceptance, correction, confirmation, reprocessing, candidate-corpus preview, and historical persisted-decision reads. It verifies that a reported value remains raw evidence, stated clinical axes take precedence over reviewed panel policy, unsupported or conflicting policy admission fails closed, and an active persisted decision is read without silently re-running the current Resolver or Registry policy.

The shared preparation, identity, and historical-read contracts are internal service behavior. They require developer evidence in addition to the product-interface checks below.

## Before you start

- [ ] Use a dedicated non-production test account.
- [ ] Use only synthetic or de-identified laboratory documents.
- [ ] Confirm the document has finished processing before reviewing its extracted biomarkers.
- [ ] Do not use a real patient report or production correction for these checks.

## Test data

| ID            | Test document or setup                                                                                                                                                                           | Purpose                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `EH248-UI-01` | Synthetic CBC report with a hemoglobin row under a page-verified CBC heading; include a separate glucose row in the same heading and one chemistry row with an explicitly stated serum specimen. | Stated-axis and reviewed-panel normal path.       |
| `EH248-UI-02` | Synthetic laboratory report containing a row with no specimen and no verified section support, plus a comparator value such as `<0.20`.                                                          | Incomplete evidence and EH-164 marker regression. |
| `EH248-UI-03` | One reviewable row that has an earlier saved revision and a current corrected revision.                                                                                                          | Correction and historical restore path.           |
| `EH248-UI-04` | A document with several exact Registry 2.0 matches and at least one excluded/incomplete row.                                                                                                     | Batch verification, recheck, and undo path.       |

| `EH248-UI-05` | A row with an active persisted revision containing a valid technical decision trace and stored release metadata. | Persisted source and available quality are visible without a current Resolver preview. |
| `EH248-UI-06` | A newly extracted row before acceptance, plus the same row after acceptance or correction. | Preview is marked not persisted; after persistence the source changes to persisted and remains authoritative. |
## Interface checks

### EH248-UI-01: Review evidence without inventing specimen

**Precondition:** `EH248-UI-01` is processed and appears in **Documents** with the **Extracted biomarkers** panel.

1. Open the synthetic document in **Documents**.
2. Open **Extracted biomarkers** and select the hemoglobin row.
3. Confirm the source page shows the synthetic CBC heading and the row value.
4. Review the row's visible outcome and technical details.
5. Select the explicitly serum-labeled chemistry row and compare its displayed specimen evidence.

**Expected result:** The CBC hemoglobin row may use the reviewed CBC whole-blood policy only for its allowlisted analyte. The glucose row does not receive whole-blood merely because it shares the CBC heading. A stated serum specimen remains the stated evidence. The interface does not display a concrete mapping for an unsupported or conflicting policy admission.

**Result:** `N/A — live product environment was not available during implementation verification`
**Notes / evidence link:** `EH-248 verifier and candidate technical gate; see developer evidence`

### EH248-UI-02: Preserve incomplete and comparator evidence

**Precondition:** `EH248-UI-02` is processed and appears in **Extracted biomarkers**.

1. Open **Documents** → the synthetic report → **Extracted biomarkers**.
2. Select the row without a specimen or verified section support.
3. Confirm the printed comparator value is visible as reported.
4. Review the row outcome and its technical details.
5. If the row is eligible for raw acceptance, select it and click **Accept selected**.
6. Reopen or refresh the document review.

**Expected result:** The row remains incomplete/non-concrete rather than being assigned a fabricated specimen. The comparator remains factual text evidence with no numeric value. Accepting the row preserves the reported value and does not make it a numeric Health Profile score or trend input.

**Result:** `N/A — live product environment was not available during implementation verification`
**Notes / evidence link:** `pnpm test:eh164` passed; see developer evidence

### EH248-UI-03: Correct and restore a saved revision

**Precondition:** `EH248-UI-03` has a current active revision and an earlier saved revision visible in the review row.

1. Open **Documents** → the synthetic report → **Extracted biomarkers**.
2. Select the row and enter a synthetic correction with a non-empty reason.
3. Click **Save correction** and wait for the review projection to refresh.
4. Confirm the corrected revision is active and the raw reported value remains visible.
5. In the earlier-revision controls, enter a reason for the restore and click **Restore** for the selected saved revision.
6. Refresh the review row and inspect its visible outcome and history.

**Expected result:** Correction creates a new revision. Restore creates a new reversal revision that reproduces the selected saved decision and its displayed evidence; it does not silently re-resolve the current row through current policy. Earlier revisions remain immutable, and a stale active revision is rejected rather than overwriting a concurrent change.

**Result:** `N/A — live product environment was not available during implementation verification`
**Notes / evidence link:** `Pure restore and CAS coverage is recorded in EH-248 verifier; SQL execution is blocked by unavailable local Docker`

### EH248-UI-04: Verify and undo exact matches

**Precondition:** `EH248-UI-04` is processed and the review screen shows the batch verification panel.

1. Open **Documents** → the synthetic report → **Extracted biomarkers**.
2. Select one or more rows shown as eligible exact matches.
3. Click **Verify eligible matches** and then **Confirm verification**.
4. Confirm the screen reports verified results and leaves excluded rows for individual review.
5. Click **Undo last batch verification**, enter a synthetic reason, and click **Confirm undo**.
6. Refresh the document review.

**Expected result:** Server-side rechecking verifies only unchanged eligible rows. Undo restores only results that remain unchanged; rows changed after the batch stay untouched and are reported as such. Review and downstream Health Profile projections refresh after each action.

**Result:** `N/A — live product environment was not available during implementation verification`
**Notes / evidence link:** `Existing EH-116 verification passed; service/database execution evidence is separate`

### EH248-UI-05: Read the stored decision, not a current re-resolution

**Precondition:** `EH248-UI-05` has an active persisted revision and the current document source is still published.

1. Open **Documents** → the synthetic report → **Extracted biomarkers**.
2. Select the row and open its technical details.
3. Confirm the decision source is **Persisted decision**, not **Current preview**.
4. Confirm quality is **Available**, `not persisted` is absent, and the displayed outcome/key match the saved revision.
5. Refresh the document and inspect the same row again.

**Expected result:** Refreshing does not call the current Resolver to reinterpret the active revision. The stored outcome, identity, trace summary, release metadata, and source label remain stable. The UI does not expose raw source text or an unallowlisted candidate as technical evidence.

**Result:** `N/A — live product environment was not available during implementation verification`
**Notes / evidence link:** `pnpm test:historical-persisted-decision-read` covers persisted authority and allowlisted trace fields.

### EH248-UI-06: Distinguish preview from persisted history

**Precondition:** `EH248-UI-06` is a newly extracted row with no active normalization revision.

1. Open **Documents** → the synthetic report → **Extracted biomarkers**.
2. Select the row and inspect its technical details before accepting it.
3. Confirm the decision source is **Current preview** and the row is marked **not persisted**.
4. Confirm the row has no concrete Health Profile binding while it is only a preview.
5. Accept or correct the row using synthetic data, wait for the review projection to refresh, and inspect the details again.

**Expected result:** The pre-acceptance explanation is explicitly preview-only and cannot become historical state by being read. After a saved revision exists, the source changes to **Persisted decision**; a missing/invalid trace or conflicting fields are labeled unavailable/conflict and fail closed rather than falling back to a fresh explanation.

**Result:** `N/A — live product environment was not available during implementation verification`
**Notes / evidence link:** `pnpm test:historical-persisted-decision-read` covers preview, unavailable, conflict, and persisted precedence states.

## Developer evidence required

- [x] `pnpm test:eh248` — Change A resolver evidence identity and admission boundary regression. **Passed.**
- [x] `pnpm check:registry-v2-candidate-corpus-technical` — candidate corpus technical resolver evidence and thresholds. **Passed.**
- [x] `pnpm test:eh164` — comparator/detection-limit markers remain accepted text evidence with `value: null` and remain excluded from numeric score/trend contribution. **Passed.**
- [x] Change B focused regressions: `pnpm test:historical-persisted-decision-read`, `pnpm test:document-review`, `pnpm test:eh106-consumer`, `pnpm test:eh112`, `pnpm test:eh117`, `pnpm test:eh119`, `pnpm test:eh120`, `pnpm test:eh121`, `pnpm test:eh142`, `pnpm test:eh143`, `pnpm test:eh145`, `pnpm test:eh146`, `pnpm test:eh147`, `pnpm test:trace-v2`, `pnpm test:health-profile-lab-input`, `pnpm test:eh123`, `pnpm test:health-profile-admission-baseline`, `pnpm test:health-profile-assessment-read`, `pnpm test:health-profile-drawer-status`, and `pnpm test:health-profile-reported-results`. **Passed.**
- [x] `pnpm exec tsc --noEmit` — application TypeScript compilation. **Passed.**
- [x] `pnpm check:ci-suite-coverage-contract` and `pnpm check:ci-suite-coverage` — the focused reader verifier is registered in CI with no orphaned or partial suite entries. **Passed.**
- [x] `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` — canonical generated documentation is current and green. **Passed.**
- [x] `pnpm render:biomarker-wiki` and explicit local staging export — seven Wiki pages rendered and staged under `.tmp/eh248-change-b-wiki-stage-3`; `git ls-remote` confirmed the Wiki remote is reachable. **Local evidence only; publication remains PENDING because no push is authorized.**
- [ ] `pnpm test:eh248-db` — no Change B migration was added; local execution remains unavailable because Docker Desktop's Linux engine is unavailable. Reuse the inherited Change A CI database evidence when the branch is published.
- [ ] `pnpm check:registry-v2-candidate-corpus` — inherited release approval bindings remain pending human renewal; signed records are intentionally not rewritten by Change B.
- [ ] Remote Wiki publication and remote PR creation — **PENDING** because the user explicitly prohibited pushing the branch.
- [x] `openspec validate historical-persisted-decision-read --strict` — final Change B artifact validation after implementation and task checklist updates. **Passed.**

## Out of scope or not manually testable yet

- Live product-interface checks are `N/A` in this implementation environment; the numbered actions and expected outcomes above are the handoff for a tester with a seeded non-production account.
- The shared prepared-evidence object, SHA-256 canonical identity, SQL constraints, RPC payload validation, reprocessing create/activate policy, and same-source CAS are not directly observable through the current product UI; use the developer commands and CI database run above.
- The generated Wiki mirror is a non-authoritative artifact. Local rendering is complete, but remote Wiki publication remains **PENDING** until the generated pages are published through the approved Wiki path.
