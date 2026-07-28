# Registry 2.0 launch cutover checklist

Procedural only. Architecture rationale lives in
[`adr/0001-registry-v2-hard-cutover.md`](adr/0001-registry-v2-hard-cutover.md).

## 0. Preconditions

- [ ] Working tree / deploy candidate SHA: `________`
- [ ] Environment class declared: **Fresh/disposable** or **Retained**
- [ ] Measurement Registry workflow listens to `master` (not `main`) and supports
      `workflow_dispatch`
- [ ] EH-106 writers are live; legacy promotion RPC is absent from runtime
- [ ] Operator has service-role access only where required; no direct client RPC
      promotion

## 1A. Fresh / disposable

1. Stop document-processing traffic and workers.
2. Run a full database rebuild:

   ```bash
   supabase db reset
   ```

   This applies migrations `001`–`034`. **Do not** call
   `pnpm reset:eh104-phase-b` / `eh104_phase_b_reset_document_derived_laboratory_lineage`
   before migration `034` exists.
3. Deploy compatible web app + document worker together.
4. Run:

   ```bash
   pnpm preflight:eh104
   ```

   Preflight MUST be clean.
5. Execute smoke checks in section 2.
6. Capture evidence in section 3.

### Optional disposable lineage reset after 034 exists

Only on an explicitly disposable environment, and only after migration `034`
exists:

```bash
EH104_PHASE_B_DISPOSABLE=1 EH104_PHASE_B_ALLOW_RESET=1 pnpm reset:eh104-phase-b
pnpm preflight:eh104
```

## 1B. Retained / persistent

1. Deploy EH-106-compatible web app + worker **first**.
2. Stop workers / drain laboratory and instrumental jobs.
3. Run:

   ```bash
   pnpm preflight:eh104
   ```
4. If preflight is dirty → **ABORT**.
   - Do not destructive-reset retained data.
   - Do not force-apply enforcement on dirty rows.
5. If preflight is clean → apply/verify migration
   `034_eh104_phase_b_enforcement.sql` through the normal migration path if not
   already present.
6. Execute smoke checks in section 2.
7. Capture evidence in section 3.

## 2. Smoke checks

- [ ] Accept one reviewed resolved laboratory row → remains concrete /
      user-verified after refresh
- [ ] Accept one partial/ambiguous/unmapped raw row → stays pending; no invented
      specimen/definition
- [ ] Process one instrumental report → not treated as laboratory resolver/score
      input
- [ ] Owner deletes a laboratory document with accepted observations → purge path
      succeeds without half-linked residue

## 3. Verify commands

```bash
pnpm check:no-registry-v1-runtime
pnpm check:no-legacy-promotion-rpc
pnpm check:registry-v2-cutover
pnpm check:registry-v2-candidate-corpus
pnpm test:cbc-regression
pnpm test:eh104
pnpm test:eh105
pnpm test:eh106
pnpm typecheck
```

CI database authority (Docker/Supabase runners):

- `pnpm test:eh104-db`
- `pnpm test:eh105-db`
- `pnpm test:eh106-db`

## 4. Evidence record

Fill after the EH-108 change merges to `master`. Do **not** use baseline
`291087a` as the acceptance SHA.

| Field | Value |
| --- | --- |
| Final `master` SHA | `________` |
| CI verify job URL | `________` |
| CI database job URL | `________` |
| Catalog manifest digest | `________` |
| Candidate input hash | `________` |
| Candidate manifest hash | `________` |
| Candidate report hash | `________` |
| Evidence interpretation | Expected launch package pattern: **2 concrete resolved / 42 intentional partial** |

Obtain candidate hashes from:

```bash
pnpm report:registry-v2-candidate-corpus
```

## 5. Forward-only rollback

Allowed:

1. Stop writers/jobs.
2. Fix Registry 2.0 definitions, fixtures, or application code.
3. Reprocess documents or reset an explicitly disposable environment.
4. Re-run verify + capture new hash-bound evidence.

Forbidden:

- Restore Registry v1 runtime
- Enable `off/shadow/promote` dual-runtime flags
- Invent concrete keys/specimen to make incomplete rows “pass”
