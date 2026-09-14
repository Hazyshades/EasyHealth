# EH-248: Resolver evidence identity and admission

**Roadmap status:** Implementation complete on the dedicated branch; database execution, candidate approval renewal, and Wiki publication remain pending external gates
**Build / environment:** `feat/248-resolver-evidence-identity` at implementation verification
**Test run date:** `2026-09-14`
**Tester:** `Codex implementation verification`

## What this checklist covers

This checklist covers the Registry 2.0 evidence path used by document review, acceptance, correction, confirmation, reprocessing, and candidate-corpus preview. It verifies that a reported value remains raw evidence, stated clinical axes take precedence over reviewed panel policy, unsupported or conflicting policy evidence fails closed, and historical undo restores a saved decision rather than reinterpreting the current row.

The shared preparation and identity contracts are internal service behavior. They require developer evidence in addition to the product-interface checks below.

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

## Developer evidence required

- [x] `pnpm test:eh248` — pure admission order, sentinels, source-analyte allowlist, zero/one/multiple policy matching, conflict fail-closed behavior, canonical identity, review/writer/corpus parity, historical restore contract, reprocessing facts, release-refresh intent, and non-mutating corpus checks. **Passed.**
- [x] `pnpm check:registry-v2-candidate-corpus-technical` — candidate corpus technical resolver evidence and thresholds. **Passed.**
- [x] `pnpm test:eh164` — comparator/detection-limit markers remain accepted text evidence with `value: null` and remain excluded from numeric score/trend contribution. **Passed.**
- [x] Existing focused regressions: `pnpm test:eh116`, `pnpm test:eh119`, `pnpm test:eh120`, `pnpm test:eh121`, `pnpm test:trace-v2`, `pnpm test:observation-provenance`, `pnpm test:panel-specimen`, `pnpm test:stated-axis`, `pnpm test:health-profile-lab-input`, and `pnpm test:health-profile-admission-baseline`. **Passed.**
- [x] `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs` — canonical generated documentation is current and green. **Passed.**
- [x] `pnpm render:biomarker-wiki` and explicit local staging export — seven Wiki pages rendered and staged under `.tmp/eh248-wiki-stage`; the Wiki remote is reachable by `git ls-remote`. **Local evidence only; publication is pending because this task must not push.**
- [ ] `pnpm test:eh248-db` — migration constraints, RPC signatures, trusted writer validation, restore CAS, reprocess fact propagation, and history triggers. **Blocked:** local Supabase tests require Docker, and the Docker Linux engine is unavailable. Run in CI or a Docker-enabled environment before merge.
- [ ] `pnpm check:registry-v2-candidate-corpus` — release approval bindings. **Blocked/pending human renewal:** adding the required `sourceAnalyteKey` fixture evidence changed the candidate input hash, so existing signed approval records are intentionally not rewritten.
- [x] `openspec validate prepare-resolver-evidence-identity --strict` — final artifact validation after implementation and task checklist updates. **Passed.**

- [ ] `pnpm exec tsc --noEmit` — **baseline limitation:** the repository still reports unrelated `DocumentType` errors for `consultation_note` / `discharge_summary` consumers; no changed-file-specific EH-248 diagnostics were reported.

## Out of scope or not manually testable yet

- Historical persisted-decision read quality/source states from Change B (`persisted`/`preview`, `unavailable`/`conflict`) are **out of scope** for EH-248 and require the separate coordinated OpenSpec change.
- The shared prepared-evidence object, SHA-256 canonical identity, SQL constraints, RPC payload validation, reprocessing create/activate policy, and same-source CAS are not directly observable through the current product UI; use the developer commands and CI database run above.
- The generated Wiki mirror is a non-authoritative artifact. Local rendering is complete, but remote Wiki publication is intentionally **PENDING** because the user explicitly prohibited pushing changes.
