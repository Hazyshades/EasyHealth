# EH-105 corrective evidence (PR2)

## Scope

Corrective work for EH-105 tasks 2.5 / 4.3 atomic publication behavior via
OpenSpec change `make-instrumental-publication-atomic`.

## Implemented

- Migrations `036_pr2_document_processing_attempts.sql` and
  `037_pr2_instrumental_atomic_publication.sql`
- Worker claim/prepare/finalize cutover
- Document DELETE purge helper
- Disposable reset CLI `pnpm reset:eh105-pr2`
- QA checklist updates in `QA/eh-105/checklist.md`
- pgTAP suites under `supabase/tests/pr2_*.sql` + rewritten EH-105 suite

## Local verification (this workstation)

- `pnpm test:eh105` — passed
- `pnpm typecheck` — passed
- `pnpm --dir worker exec tsc --noEmit` — passed earlier in session
- `supabase db reset` / `supabase test db` — **blocked** (no Docker/WSL)
- Local PostgreSQL 17 was started for disposable experiments; full Supabase
  migration stack was not applied end-to-end here

## Closure policy

Production and Sprint 1 closure remain **pending** until CI database gates and
manual QA execution are recorded. Do not treat local Docker waiver as Pass.

## Deploy / smoke matrix (task 7.2)

| Scenario | Status | Evidence |
| --- | --- | --- |
| Deploy attempt-aware worker/readers | Pending | Not deployed from this worktree |
| Legacy view == current pointer equivalence | Pending | Requires migrated environment |
| Resume jobs | Pending | Requires deployed worker |
| Unchanged retry smoke | Blocked locally | No Docker/Supabase stack |
| Changed reprocess smoke | Blocked locally | No Docker/Supabase stack |
| `A → B → A` smoke | Written as pgTAP | `supabase/tests/pr2_instrumental_publication_matrix.sql` (CI) |
| Stale-attempt smoke | Written as pgTAP | `supabase/tests/pr2_document_processing_attempts.sql` (CI) |
| Forced-failure smoke | Partial | concurrency/rollback suite + QA UI-08 |

Task 7.2 remains open until a migrated environment records the deploy/resume smokes above.
