## Why

Sprint 1 issues #3 (EH-103), #5 (EH-105), and #4 (EH-104) still show OPEN even though the product work is largely implemented. EH-104 Phase B exists only as local uncommitted work, and the workstation cannot run Docker/Supabase database tests. The milestone cannot progress until these issues are shipped and closed with an explicit CI-backed verification policy.

## What Changes

- Ship the already-implemented EH-104 Phase B tree (migration `034`, purge path, static bans, CI db job wiring, QA/runbook) on a dedicated branch via commit + PR.
- Treat **CI database job** (`pnpm test:eh104-db`, and existing eh105/eh106 db jobs when wired) as the sole required database proof. **Do not** require local `supabase db reset` / Docker on the developer workstation.
- Close GitHub **#3 EH-103** after checklist sync + delivery comment (OpenSpec already complete).
- Close GitHub **#5 EH-105** after delivery comment that records remaining db proof as CI-only (tasks 4.6/5.2 waived locally).
- Close GitHub **#4 EH-104** only after Phase B PR is merged (or merge-ready with CI green) and static verification passes; operator smoke 7.x is documented as post-merge/CI follow-up when no disposable env is available from this workstation.
- Update QA checklists for EH-103/105/104 closeout notes (developer evidence; no fake manual pass marks).
- Archive or mark complete the related OpenSpec changes once issues are closed (`eh-103-*`, `eh-105-*`, `eh-104-phase-b-*` as applicable).
- **Out of scope:** EH-107 CBC fixtures, EH-108 ADR, local Supabase/Docker setup, production deploy, starting the document worker for live smoke if env is unavailable.

## Capabilities

### New Capabilities

- `roadmap-delivery-closeout`: Process and verification gates for closing Sprint 1 roadmap issues when implementation is complete but local database stacks are unavailable; CI is the database authority.

### Modified Capabilities

- None. Product runtime requirements for EH-104 Phase B remain owned by `eh-104-phase-b-enforcement-and-legacy-rpc-removal`. This change does not alter observation, documents-api, or extraction-review behavior beyond shipping that already-specified work.

## Impact

- **Domain:** documents / observation integrity (ship only) + roadmap/GitHub hygiene.
- **Git:** new branch from current Phase B working tree (not `roadmap/eh-107` long-term); PR into default branch.
- **CI:** Measurement Registry workflow already extended to run EH-104 db tests; must go green on the PR.
- **GitHub Issues:** #3, #5, #4 comments + close.
- **OpenSpec:** closeout change tasks; archive upstream EH-103/105/104 Phase B changes after ship.
- **Constraint:** no local Supabase/Docker commands as a developer gate.
