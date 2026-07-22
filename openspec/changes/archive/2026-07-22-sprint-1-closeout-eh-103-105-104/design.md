## Context

Sprint 1 milestone still has OPEN issues whose implementation is mostly finished:

| Issue | Code reality | Gap |
| --- | --- | --- |
| #3 EH-103 | OpenSpec 18/18 complete; migrations/QA present | Issue hygiene / close |
| #5 EH-105 | OpenSpec 24/26; instrumental lineage on tree | Local db tasks 4.6/5.2 never run; issue open |
| #4 EH-104 | Phase A done earlier; Phase B implemented locally | Uncommitted on wrong branch (`roadmap/eh-107`); no PR/CI |

Workstation constraint (hard): **no Docker / no local Supabase db tests.**

Related OpenSpec change already holds Phase B product design: `eh-104-phase-b-enforcement-and-legacy-rpc-removal` (26/29; remaining 7.x operator).

## Goals / Non-Goals

**Goals:**

- Land Phase B code on a clean PR branch and get CI database proof.
- Close #3, #5, #4 with honest evidence comments (CI vs local).
- Keep developer verification limited to static/unit scripts runnable without Docker.
- Document operator 7.x smoke as follow-up when env exists, without blocking issue close if CI db is green and product code is merged.

**Non-Goals:**

- Implementing EH-107/EH-108.
- Running `supabase db reset`, `supabase test db`, or Docker locally.
- Fixing document-worker offline / heartbeat ops as part of this closeout (note only if it blocks optional smoke).
- Changing Phase B product design (MATCH FULL deferred, purge RPC, etc.).

## Decisions

### D1 — Closeout is a delivery change, not a second Phase B design

**Decision:** Reuse `eh-104-phase-b-enforcement-and-legacy-rpc-removal` as the product source of truth. This change only orchestrates ship + issue closeout.

**Why:** Avoid dual designs. Phase B specs already exist.

### D2 — CI is the database authority

**Decision:** Required db evidence = GitHub Actions `database` job running `pnpm test:eh104-db` (and eh105/eh106 if already in workflow). Local db commands are explicitly **not** a close gate.

**Why:** User cannot run Supabase locally. CI already has Supabase CLI + Docker runners.

### D3 — Branch hygiene

**Decision:** Move/commit Phase B files onto `roadmap/eh-104-phase-b` (or `roadmap/sprint-1-closeout`) from current dirty `roadmap/eh-107` tree. Do not mix EH-107 work into the PR title/scope.

**Files expected in PR** (non-exhaustive):

- `supabase/migrations/034_eh104_phase_b_enforcement.sql`
- `supabase/tests/eh104_observation_resolution_verification.sql`
- `src/lib/documents/laboratory-lineage-purge.ts`
- `src/app/api/documents/[id]/route.ts` (purge before delete)
- `scripts/verify-no-legacy-promotion-rpc.ts`
- `scripts/verify-eh104-phase-b-boundary.ts`
- `scripts/verify-eh104-document-delete.ts`
- `scripts/eh104-preflight.ts` / `scripts/eh104-phase-b-reset.ts`
- `package.json` scripts + `.github/workflows/measurement-registry.yml`
- `QA/eh-104/checklist.md`
- `openspec/changes/eh-104-phase-b-enforcement-and-legacy-rpc-removal/**`

Exclude noise: `$env`, `.papercuts.jsonl` unless project wants papercuts committed separately.

### D4 — Issue close criteria

```
#3 EH-103
  code already on master historically
  → delivery comment + checklist note → CLOSE

#5 EH-105
  code on master / prior branches
  → comment: OpenSpec 24/26; 4.6/5.2 = CI-only waiver
  → CLOSE when static evidence + CI path acknowledged
  (if eh105-db not on CI yet, add to workflow in same PR as Phase B)

#4 EH-104
  → PR merge + CI database green + static pnpm test:eh104
  → comment with links
  → CLOSE
  → operator 7.x recorded as residual ops note if no env
```

### D5 — Operator tasks 7.x

**Decision:** Do not fail closeout solely because disposable env smoke is impossible from this workstation **if** CI db is green and migration is merged. Record residual risk on the issue: preflight on retained envs still required before production enforcement apply.

**Why:** Pre-launch disposable DBs may only exist in CI; production apply remains a separate ops step.

### D6 — Verification commands (local, no Docker)

```
pnpm test:eh104
pnpm test:eh106-writer   # regression
pnpm typecheck
openspec validate eh-104-phase-b-enforcement-and-legacy-rpc-removal --strict
openspec validate sprint-1-closeout-eh-103-105-104 --strict
```

Forbidden as local gates: `supabase db reset`, `pnpm test:eh104-db`, `pnpm test:eh105-db`, `pnpm test:eh106-db`.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| CI db job fails on Phase B fixtures | Fix on PR from CI logs; still no local Docker required if remote CI used |
| Closing #5 without ever running instrumental pgTAP | Wire `test:eh105-db` into CI in the same PR |
| Closing #4 without live smoke | Explicit residual ops note; do not claim manual QA passed |
| Dirty branch mixes EH-107 | Dedicated branch name + PR scope only Phase B/closeout |
| Issue close without merge | Never close #4 before merge or explicit user override |

## Migration Plan

1. Create clean branch; stage Phase B + closeout artifacts only.
2. Commit; push; open PR.
3. Wait for CI (especially `database`).
4. Local static verify (no Supabase).
5. Comment + close #3, #5 (can be parallel once evidence written).
6. After CI green + merge: comment + close #4.
7. Archive OpenSpec changes as appropriate.

## Open Questions

None blocking. Assumed:

- Default branch is `master`.
- User accepts CI-only db proof.
- Operator smoke may remain residual after issue close if no env.
