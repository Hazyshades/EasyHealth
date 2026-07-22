## 1. Branch and Phase B ship prep

- [x] 1.1 Create dedicated branch `roadmap/eh-104-phase-b` (or `roadmap/sprint-1-closeout`) from current work; do not leave Phase B scoped as EH-107.
- [x] 1.2 Stage only Phase B + closeout files; exclude noise (`$env`, unrelated papercuts unless intentional).
- [x] 1.3 Confirm CI workflow runs `pnpm test:eh104-db` and add `pnpm test:eh105-db` to the database job if missing so EH-105 close has a CI path.
- [x] 1.4 Run local no-Docker verification only: `pnpm test:eh104`, `pnpm test:eh106-writer`, `pnpm typecheck`, and OpenSpec strict validate for Phase B + this closeout change.

## 2. Pull request

- [x] 2.1 Commit with a message scoped to EH-104 Phase B ship + Sprint 1 issue closeout.
- [x] 2.2 Push branch and open PR to `master` linking #4 (and #3/#5 as related).
- [x] 2.3 Record CI database job result on the PR; fix fixture/migration failures from CI logs only (no local Supabase requirement).
- [x] 2.4 Merge PR when CI is green (or stop and report if CI blocked).

## 3. GitHub #3 EH-103 close

- [x] 3.1 Sync `QA/eh-103/checklist.md` developer-evidence notes (CI/static; no false manual passes).
- [x] 3.2 Post delivery comment on #3 with OpenSpec complete status and evidence pointers.
- [x] 3.3 Close issue #3.

## 4. GitHub #5 EH-105 close

- [x] 4.1 Post delivery comment on #5: implementation complete; tasks 4.6/5.2 local db waived; CI `test:eh105-db` (or equivalent) is the database authority.
- [x] 4.2 Update `QA/eh-105/checklist.md` with CI-only developer evidence note.
- [x] 4.3 Close issue #5.

## 5. GitHub #4 EH-104 close

- [x] 5.1 Post delivery comment on #4 with PR link, static verify results, CI db evidence, and residual operator 7.x note if smoke env unavailable.
- [x] 5.2 Close issue #4 only after merge + CI db evidence is recorded.
- [x] 5.3 Mark remaining operator tasks in `eh-104-phase-b-enforcement-and-legacy-rpc-removal` as done or explicitly deferred in the issue comment (no fake local preflight success).

## 6. OpenSpec hygiene

- [x] 6.1 Mark this closeout change tasks complete as each section finishes.
- [x] 6.2 Archive or note archive-readiness for `eh-103-observation-provenance-metadata`, `eh-105-cut-over-observations-to-registry-2-identity`, and `eh-104-phase-b-enforcement-and-legacy-rpc-removal` after issues close.
