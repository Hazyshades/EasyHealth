## Context

PR #94 combines EH-110 alias authority with EH-109 resolver v6. Its candidate corpus report remains behaviorally correct: all eight thresholds pass, 44/44 classifications match, recognition/alias/unit coverage are 100%, and false concrete resolutions and processing errors are zero. The candidate-input hash nevertheless changed from `0f5787…` to `be851e…` because the release identity includes the resolver version and registry manifest. Existing approvals correctly fail closed because they remain bound to the old hash.

The PR merge ref also includes master migration `036_pr2_document_processing_attempts.sql`. Its `claim_document_processing_job(uuid)` function returns an output named `document_id` and uses an unqualified `document_id` column in an active-attempt query. PostgreSQL therefore reports an ambiguous column when the EH-105 database fixture invokes the function.

## Goals / Non-Goals

**Goals:**

- Renew release evidence for the exact verified EH-109 candidate input without changing corpus expectations or resolver behavior.
- Repair the claim RPC through an additive migration that is safe for databases where migration 036 already ran.
- Restore all required PR #94 checks and merge only after they are green.

**Non-Goals:**

- Change scoring weights, thresholds, aliases, measurement definitions, or expected corpus classifications.
- Rewrite migration 036 or mutate existing processing attempts.
- Change the claim RPC signature, permissions, lock order, or worker callers.

## Decisions

### 1. Renew approvals only after comparing the full report

Use `pnpm report:registry-v2-candidate-corpus` to establish the new candidate-input hash and record the complete threshold and mismatch summary. Update every required approval to the same new hash and revise approval identifiers/notes to make the renewal explicit. Then run both candidate-corpus test and check commands.

Alternative rejected: remove resolver version from the candidate hash or reuse the old hash. Both would defeat fail-closed release identity.

### 2. Add a repair migration instead of editing migration 036

Bring the current `master` migrations into the feature branch, then add the next migration containing `CREATE OR REPLACE FUNCTION public.claim_document_processing_job(uuid)`. The replacement copies the deployed contract and changes the active-attempt query to use a table alias and qualified columns.

Alternative rejected: edit migration 036. Existing environments may already have recorded it, so modifying history would make fresh resets differ from upgraded databases.

### 3. Treat green required checks as the merge gate

Run the local registry suite, candidate corpus gates, typecheck, and available Supabase database fixture. Push the fix commit and merge PR #94 only after GitHub reports required checks successful.

## Risks / Trade-offs

- [Approval renewal could fabricate review] → Renew only after the report proves every threshold and classification is unchanged; record exact evidence and explicit approval scope.
- [Copying the RPC could drift from master] → Source the replacement from the current master migration and change only SQL qualification.
- [The database fixture requires local Supabase] → Use the GitHub database job as authoritative if the local stack is unavailable; never override a red required check.

## Migration Plan

1. Integrate current `master` so migrations 036 and 037 are present locally.
2. Generate and review the candidate report, then renew all required hash-bound approvals.
3. Add the next additive migration replacing the claim RPC with qualified processing-attempt columns.
4. Run registry and database contract checks; commit and push.
5. Merge PR #94 after required GitHub checks are green.
6. Rollback by reverting the repair commit before merge; after deployment, replace the function with another additive migration rather than deleting migration history.

## Open Questions

None. The report shows no classification or threshold regression; both repairs are bounded and reproducible.