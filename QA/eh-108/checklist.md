# EH-108: Registry 2.0 hard-cutover ADR and launch checklist

**Roadmap status:** Delivered  
**Build / environment:** `master@3e7f57b` / Measurement Registry CI  
**Test run date:** `2026-07-23`  
**Tester:** `tech-lead / CI`

## What this checklist covers

Confirms that a new engineer can explain the single Registry 2.0 runtime
decision, run the Fresh or Retained cutover path without circular Phase B reset
instructions, and correctly interpret launch candidate evidence
(**2 concrete resolved / 42 intentional partial** for the current 44-row
package).

## Before you start

- [ ] Use a dedicated test account and synthetic/de-identified documents only.
- [ ] Read [`registry/adr/0001-registry-v2-hard-cutover.md`](../../registry/adr/0001-registry-v2-hard-cutover.md).
- [ ] Keep [`registry/launch-cutover-checklist.md`](../../registry/launch-cutover-checklist.md) open for commands.
- [ ] Do **not** treat baseline commit `291087a` as final acceptance evidence.

## Test data

| ID | Setup | Purpose |
| --- | --- | --- |
| `EH108-DOCS` | ADR + launch checklist + registry README | Explain decision/ownership |
| `EH108-FRESH` or `EH108-RETAINED` | Declared environment class | Execute cutover path |
| `EH108-CORPUS` | `registry/candidate-release/v1` report output | Interpret 2/42 evidence |

## Interface / walkthrough checks

### EH108-01: Explain the state and version model

**Precondition:** Engineer has only registry docs (not OpenSpec archive history).

1. Open the ADR.
2. Explain single-runtime vs rejected dual-runtime.
3. Explain maturity × resolver consumer eligibility.
4. Name the separate version axes (architecture 2.0, catalog manifest, resolver,
   normalization, provenance, candidate package).
5. State EH-104 as a direct dependency, EH-106 as corpus/manifest/approvals
   source, and EH-107 as separate CBC evidence.

**Expected result:** Explanation matches the ADR; instrumental lineage is
described as separate from lab resolver/score inputs; no shadow/promote rollback
is proposed.

**Result:** `Pass`  
**Notes / evidence link:** ADR + PR #90 delivery; structure/ownership documented

### EH108-02: Execute a clean cutover path

**Precondition:** Environment class is declared Fresh/disposable or Retained.

1. Follow only `registry/launch-cutover-checklist.md`.
2. For Fresh: confirm `supabase db reset` is used and Phase B reset RPC is **not**
   called before migration 034.
3. For Retained: confirm dirty preflight aborts with no destructive reset.
4. Run the verify command block from the launch checklist.

**Expected result:** Operator completes the matching scenario without circular
reset guidance and without enabling shadow/promote modes.

**Result:** `Pass`  
**Notes / evidence link:** Launch checklist + Phase B runbook corrected; master CI verify/database green

### EH108-03: Interpret candidate evidence correctly

**Precondition:** Candidate report for package v1 is available.

1. Run or open `pnpm report:registry-v2-candidate-corpus` output.
2. Locate resolved vs partial counts for the 44-row package.
3. Record hashes in the evidence table below.

**Expected result:** Tester treats **2 concrete resolved / 42 intentional
partial** as the recognition-safe expected pattern, not as a coverage failure.
CBC antipair proof is attributed to EH-107, not conflated with the 44-row
corpus.

**Result:** `Pass`  
**Notes / evidence link:** `pnpm report:registry-v2-candidate-corpus`; expected 2 resolved / 42 partial; hashes below

## Developer evidence required

Fill after EH-108 merges to `master`. Baseline `291087a` is not acceptable as
the final evidence SHA.

| Field | Value |
| --- | --- |
| Final post-EH-108 `master` SHA | `3e7f57b3d7ea29aae234f0f20a935a1c6f05e4b8` |
| CI verify job URL | https://github.com/Hazyshades/EasyHealth/actions/runs/29998228036/job/89176907450 |
| CI database job URL | https://github.com/Hazyshades/EasyHealth/actions/runs/29998228036/job/89176907386 |
| Catalog manifest digest | `e799e168a36463dfcef19d59690010a0d4c117e06b9790401c0c25810a5c9eea` |
| Candidate input hash | `b4489a7cae9ab40cef27e308f1fe64fb45eca55cfe612d806a5c4370e0116b13` |
| Candidate manifest hash | `a092449de73056b17b600dc6b9d2e5e141509ab362cb6e32ad73f8104045d754` |
| Candidate report hash | `44395892185dd8182f27144987cf0d6440177d1cb6bc8bdce5db35e95371854d` |

- [x] Measurement Registry workflow push trigger is `master` and supports
      `workflow_dispatch`.
- [x] `registry/measurement-registry-rollout.md` is a superseded stub with no
      active shadow/promote instructions.
- [x] Default catalog changelog string says Registry 2.0.
- [x] Phase B operator docs state reset RPC is post-034 / disposable-only.

## Out of scope or not manually testable yet

- New `033 + dirty` automated DB harness.
- Approvals redesign beyond existing EH-106 role fixtures.
- `/docs` tree repair (#75).
- EH-109…EH-120 product behavior.
- Post-merge CI evidence recorded from master run 29998228036 on SHA `3e7f57b`.
