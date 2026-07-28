## Context

PR #94 combines EH-110 alias authority with EH-109 resolver v6. Its candidate corpus report remains behaviorally correct: all eight thresholds pass, 44/44 classifications match, recognition/alias/unit coverage are 100%, and false concrete resolutions and processing errors are zero. After integrating current `master`, the exact candidate-input hash is `92fad306621e4b4a473eea08a5431609942fa97eaeb669985cefbad93d323fc7`; approvals bound to `b4489a7…` correctly fail closed.

The PR merge ref includes master migrations `036_pr2_document_processing_attempts.sql` and `037_pr2_instrumental_atomic_publication.sql`. The claim RPC returns an output named `document_id` while querying an unqualified `document_id`. Successive authoritative GitHub database-fixture runs exposed the same PL/pgSQL class in both publication RPCs: prepare queries unqualified `canonicalization_version`, `snapshot_hash`, and `snapshot_content_id`, while finalize increments an unqualified `write_generation`. The EH-105 fixture also used mismatched dollar-quote delimiters in two `throws_ok` cases.

## Goals / Non-Goals

**Goals:**

- Renew release evidence for the exact verified EH-109 candidate input without changing corpus expectations or resolver behavior.
- Repair the claim, publication-preparation, and publication-finalization RPCs through one additive migration that is safe for databases where migrations 036–037 already ran.
- Restore all required PR #94 checks and merge only after they are green.

**Non-Goals:**

- Change scoring weights, thresholds, aliases, measurement definitions, or expected corpus classifications.
- Rewrite migrations 036–037 or mutate existing processing attempts, snapshots, or publications.
- Change any repaired RPC signature, permissions, lock order, ownership checks, or worker callers.

## Decisions

### 1. Renew approvals only after comparing the full report

Use `pnpm report:registry-v2-candidate-corpus` to establish the new candidate-input hash and record the complete threshold and mismatch summary. Update every required approval to the same new hash and revise approval identifiers/notes to make the renewal explicit. Then run both candidate-corpus test and check commands.

Alternative rejected: remove resolver version from the candidate hash or reuse the old hash. Both would defeat fail-closed release identity.

### 2. Add a repair migration instead of editing migrations 036–037

Bring the current `master` migrations into the feature branch, then add the next migration containing `CREATE OR REPLACE FUNCTION` definitions for the claim, publication-preparation, and publication-finalization RPCs. Copy each deployed function and change only table aliases and qualified column references that collide with output names.

Alternative rejected: edit migrations 036–037. Existing environments may already have recorded them, so modifying history would make fresh resets differ from upgraded databases.

### 3. Treat green required checks as the merge gate

Run the local registry suite, candidate corpus gates, typecheck, and available Supabase database fixture. Push the fix commit and merge PR #94 only after GitHub reports required checks successful.

## Risks / Trade-offs

- [Approval renewal could fabricate review] → Renew only after the report proves every threshold and classification is unchanged; record exact evidence and explicit approval scope.
- [Copying the RPCs could drift from master] → Source each replacement from the current master migration and change only SQL qualification.
- [The database fixture requires local Supabase] → Use the GitHub database job as authoritative if the local stack is unavailable; never override a red required check.

## Migration Plan

1. Integrate current `master` so migrations 036 and 037 are present locally.
2. Generate and review the candidate report, then renew all required hash-bound approvals.
3. Add the next additive migration replacing all three affected RPCs with qualified table columns and correct the malformed fixture quoting.
4. Run registry and database contract checks; commit and push.
5. Merge PR #94 after required GitHub checks are green.
6. Rollback by reverting the repair commit before merge; after deployment, replace the function with another additive migration rather than deleting migration history.

## Open Questions

None. The report and CI failures identify bounded, reproducible repairs.