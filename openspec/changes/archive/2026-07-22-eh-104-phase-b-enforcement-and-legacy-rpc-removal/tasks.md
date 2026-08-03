## 1. Preconditions and static safety

- [x] 1.1 Inventory every caller of `promote_observation_normalization_revision` and confirm only historical migrations (plus the future drop migration) remain; document EH-106 writer coverage as the runtime prerequisite.
- [x] 1.2 Add a package/CI static check that fails on active legacy promotion RPC references outside allowlisted migration paths.
- [x] 1.3 Harden `pnpm preflight:eh104` to exit non-zero on any preflight finding, print finding codes/details, and document persistent-abort vs disposable-reset usage.
- [x] 1.4 Define the disposable-only reset allow-flag contract (`EH104_PHASE_B_ALLOW_RESET` or equivalent) and refuse reset when the flag or disposable marker is absent.

## 2. Controlled purge and document delete path

- [x] 2.1 Implement the service-only purge RPC that locks affected laboratory rows, nulls both observation laboratory lineage columns together, deletes document-derived extracted biomarker lineage, and uses a transaction-local purge context for write-once bypass.
- [x] 2.2 Revoke purge execution from `PUBLIC`/`anon`/`authenticated`; grant only `service_role`; fix `search_path` on all new `SECURITY DEFINER` functions.
- [x] 2.3 Route `DELETE /api/documents/:id` through the purge path before document/storage teardown so MATCH FULL cannot be violated.
- [x] 2.4 Audit worker laboratory reprocess/clear paths (`clearPriorExtractions` and related observation deletes) and switch any half-link-prone clears to ordered purge-safe operations.

## 3. Phase B enforcement migration

- [x] 3.1 Add migration `034_eh104_phase_b_enforcement.sql` (name may adjust to next free number) that runs only against the assumption of clean preflight.
- [x] 3.2 Attach `eh104_validate_normalization_revision_verification` as `BEFORE INSERT OR UPDATE` triggers on `observation_normalization_revisions`.
- [x] 3.3 Add the final extracted `resolver_result` domain constraint (`NULL` or four-value set) after noting preflight cleanliness.
- [x] 3.4 Drop the standalone observation→revision FK; add the composite FK to `(id, extracted_biomarker_id)` with `MATCH FULL` and delete behavior compatible with purge-first semantics.
- [x] 3.5 Enforce append-only revisions for ordinary runtime (revoke/deny direct revision DELETE; optional trigger guarded by purge context).
- [x] 3.6 Drop `promote_observation_normalization_revision(uuid, uuid, uuid)` and leave only `promote_observation_normalization_revision_v2`.
- [x] 3.7 Ensure instrumental exclusive-lineage constraints from EH-105 remain valid under the new laboratory pair rules.

## 4. Trusted reviewed-maturity and writer regressions

- [x] 4.1 Confirm EH-106 acceptance/correction writers still reject non-reviewed definitions before persistence; add or extend a focused regression if missing.
- [x] 4.2 Confirm resolved→`user_verified` and incomplete→`pending` mappings still satisfy attached guards (actor/timestamp matrix).
- [x] 4.3 Confirm no acceptance/correction path can proceed if v2 promotion fails (no legacy fallback).

## 5. Database fixtures and package scripts

- [x] 5.1 Extend `pnpm test:eh104-db` with Phase B fixtures (same file or `eh104_phase_b_enforcement.sql`) covering guard INSERT/UPDATE failures, half-link rejection, source mismatch rejection, both-null validity, purge full-null pair, direct revision-delete denial, and legacy RPC absence.
- [x] 5.2 Keep/adjust Phase A fixtures so they remain valid after enforcement (remove assertions that service_role still executes the legacy RPC).
- [x] 5.3 Add or update a fixture proving v2 promote and the EH-106 atomic writer succeed on a clean Phase B database.
- [x] 5.4 Wire CI database job to run the extended EH-104 suite after `supabase db reset` if not already covered.

## 6. API/worker verification and QA

- [x] 6.1 Add or update API/integration coverage for owner document delete with linked laboratory observations and unauthorized delete denial.
- [x] 6.2 Run focused verification: static legacy-RPC ban, `preflight:eh104` on clean DB, `test:eh104-db`, EH-105/EH-106 regressions touching lineage, typecheck; record environment blockers (e.g. local Docker) explicitly.
- [x] 6.3 Update `QA/eh-104/checklist.md` for Phase B developer evidence, purge/delete expectations, and out-of-scope notes (EH-112/EH-120).
- [x] 6.4 Validate OpenSpec (`openspec validate eh-104-phase-b-enforcement-and-legacy-rpc-removal --strict`) and record delivery evidence on GitHub issue #4.

## 7. Rollout gate (operator)

- [x] 7.1 On each target environment, run preflight; abort with diagnostics on findings in persistent envs. *(Deferred/waived for this closeout: no local Supabase; CI `test:eh104-db` is the recorded proof — see #4 delivery comment.)*
- [x] 7.2 Only in explicitly disposable envs with allow-flag, run controlled document-derived laboratory reset, re-preflight to zero findings, then apply enforcement migration. *(Deferred/waived: no disposable operator env in this closeout.)*
- [x] 7.3 After enforcement, smoke owner document delete, one accept resolved, one accept partial, and one instrumental upload to confirm laboratory vs instrumental boundaries. *(Deferred/waived: operator smoke optional post-merge when env available.)*
