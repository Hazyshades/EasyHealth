# EH-104 Phase B implementation runbook

## Runtime prerequisite

EH-106 writers must already use `write_observation_normalization_revision_v2`
only. Active application code must not call
`promote_observation_normalization_revision`.

Inventory at implementation time:

| Location | Role |
| --- | --- |
| `supabase/migrations/021_measurement_registry_governance.sql` | Historical create (allowlisted) |
| `supabase/migrations/031_eh104_phase_a_resolution_verification.sql` | Historical grant (allowlisted) |
| `supabase/migrations/034_eh104_phase_b_enforcement.sql` | Drop migration (allowlisted) |
| `src/lib/documents/observation-normalization-writer.ts` | EH-106 v2 writer only |
| `supabase/tests/*` | Phase B asserts legacy absence |

Static ban: `pnpm check:no-legacy-promotion-rpc`.

## MATCH FULL + atomic writer

The EH-106 writer inserts a source-only laboratory observation, then creates the
revision and promotes inside one transaction. Phase B therefore uses:

```sql
FOREIGN KEY (normalization_revision_id, source_extracted_biomarker_id)
  REFERENCES observation_normalization_revisions (id, extracted_biomarker_id)
  MATCH FULL
  DEFERRABLE INITIALLY DEFERRED
```

Half-links are illegal at commit/rest. They are not a supported durable state.

## Operator gate

Choose the environment class first. The Phase B reset RPC is created by
migration `034_eh104_phase_b_enforcement.sql`; it is **not** a pre-034 bootstrap
tool. Canonical operator steps also live in
`registry/launch-cutover-checklist.md`.

### Fresh / disposable bootstrap

1. Stop jobs.
2. Run `supabase db reset` so migrations `001`–`034` apply together.
3. Deploy compatible web + worker.
4. Run `pnpm preflight:eh104` and continue only when clean.

### Retained / persistent

```
pnpm preflight:eh104
```

- exit 0 → apply/verify enforcement migration on that database if needed
- exit 1 on persistent/retained data → **ABORT** (no mutation, no enforcement)

### Disposable lineage reset only after 034 exists

Only on an explicitly disposable environment, and only after migration `034`
exists:

```
EH104_PHASE_B_DISPOSABLE=1 EH104_PHASE_B_ALLOW_RESET=1 pnpm reset:eh104-phase-b
pnpm preflight:eh104   # must be clean
```

Then verify migration `034_eh104_phase_b_enforcement.sql` is present via the
normal migration path.

## Post-enforcement smoke

1. Owner deletes a laboratory document with accepted observations.
2. Accept one resolved reviewed row.
3. Accept one partial/raw row (stays pending).
4. Upload/process one instrumental report (laboratory pair columns remain null).

## Verification commands

```
pnpm check:no-legacy-promotion-rpc
pnpm test:eh104
pnpm test:eh104-db          # requires local Supabase/Docker
pnpm test:eh105
pnpm test:eh106
pnpm typecheck
```
