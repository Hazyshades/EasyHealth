## Context

EH-104 Phase A (`031_eh104_phase_a_resolution_verification.sql`) shipped:

- decision metadata columns and widened revision `verification_status`
- composite uniqueness target `observation_normalization_revisions(id, extracted_biomarker_id)`
- unattached guard function `eh104_validate_normalization_revision_verification()`
- read-only `eh104_resolution_verification_preflight()`
- service-only `promote_observation_normalization_revision_v2`
- temporary service-only retention of legacy `promote_observation_normalization_revision`

EH-105 separated instrumental lineage. EH-106 cut every acceptance/correction writer over to the atomic v2 path and Registry 2.0 identity.

Phase B is the deferred enforcement step from the original EH-104 design. Issue #4 still open until this lands. Sprint 1 data-integrity close depends on it.

Current gaps after Phase A:

```
writers (EH-106) ──v2──► promote_v2 ✅
                         legacy promote still exists ⚠
guards exist but unattached ⚠
half-linked lab observations still insertable ⚠
document DELETE uses plain documents.delete ⚠
  (ON DELETE SET NULL can leave inconsistent pairs)
```

## Goals / Non-Goals

**Goals:**

- Make the Phase A integrity contract enforceable for all laboratory writers.
- Gate enforcement on clean populated-data preflight (or explicit disposable reset).
- Preserve full null lineage pairs on document/profile purge; never half-link.
- Remove the legacy promotion RPC once static + runtime evidence shows zero callers.
- Keep instrumental observations (EH-105) outside laboratory same-source rules.
- Leave scoring eligibility unchanged.

**Non-Goals:**

- Automatic semantic repair or source-identity clearing of bad rows.
- Incomplete-outcome UX, trends, metrics (EH-112).
- Record rejection / batch idempotency / auto-verify activation (EH-120).
- CBC fixture suite (EH-107) or Registry ADR (EH-108).
- Changing Health Profile scoring filters.
- Production backfill that invents measurement definitions or verification actors.

## Decisions

### D1 — Two-step release inside Phase B, not a single blind migration

**Decision:** Split Phase B into (1) preflight gate + optional disposable reset tooling, then (2) enforcement migration that assumes a clean database.

**Why:** Persistent environments must abort with diagnostics and no mutation. Applying `MATCH FULL` or guards against dirty data fails mid-migration or locks bad state in. `NOT VALID` is forbidden (still validates new writes; hides the gate).

**Alternatives considered:**

| Option | Rejected because |
| --- | --- |
| Single migration that repairs then enforces | Silent semantic repair is out of scope and unsafe |
| `NOT VALID` constraints | Still validates new writes; masks dirty historical rows |
| App-only guards without DB enforcement | Bypassable via service role / SQL |

**Operator flow:**

```
preflight:eh104
    │
    ├─ findings == 0 ──────────────────────────────► apply enforcement migration
    │
    └─ findings  > 0
           │
           ├─ persistent env ──► ABORT (print diagnostics, no mutation)
           │
           └─ disposable + EH104_PHASE_B_ALLOW_RESET=1
                    │
                    ▼
              controlled document-derived reset
                    │
                    ▼
              re-run preflight (must be clean)
                    │
                    ▼
              apply enforcement migration
```

### D2 — Attach the existing guard function; extend it for reviewed maturity at the trusted boundary

**Decision:**

1. Attach `eh104_validate_normalization_revision_verification` as `BEFORE INSERT OR UPDATE` on `observation_normalization_revisions`.
2. Keep the DB guard focused on status/actor/timestamp + `resolved` + non-null `measurement_definition_key`.
3. Enforce “definition is `reviewed`” in the trusted service writer path (already EH-106) and add a static/regression assertion; optionally add a DB helper that the writer calls, but do **not** embed the full TypeScript Registry into Postgres.

**Why:** Registry maturity lives in application code today. Duplicating the catalog into SQL creates drift. Phase A already documented reviewed maturity as a trusted service guard.

**Alternatives considered:**

| Option | Rejected because |
| --- | --- |
| SQL table mirror of Registry | Dual source of truth; migration churn |
| Skip DB cross-axis entirely | Incomplete/verified rows could still be inserted via SQL |

### D3 — Composite FK + `MATCH FULL` for laboratory observation↔revision pairs

**Decision:** Replace standalone `observations_normalization_revision_fk` with:

```
observations (normalization_revision_id, source_extracted_biomarker_id)
  REFERENCES observation_normalization_revisions (id, extracted_biomarker_id)
  MATCH FULL
  ON DELETE NO ACTION   -- purge clears both columns first
```

Both columns null remains valid (standalone / purged / non-lab rows). Exactly one null is rejected by `MATCH FULL`.

Instrumental rows keep `source_extracted_biomarker_id` and `normalization_revision_id` both null (EH-105 exclusive lineage via `source_instrumental_measure_id`).

**Implementation note:** EH-106's atomic writer still inserts a source-only
laboratory observation before promotion inside one transaction. Phase B
therefore uses `MATCH FULL ... DEFERRABLE INITIALLY DEFERRED` so the interim
half-link is legal only until commit; half-links remain illegal at rest.


**Why:** This is the Phase A normal form. Promotion already verifies the pair; the FK makes it structural.

**Alternatives considered:**

| Option | Rejected because |
| --- | --- |
| CHECK half-link only, no FK | Weaker; allows revision id pointing at wrong extracted source |
| Keep `ON DELETE SET NULL` on revision FK | Creates half-links when extracted rows cascade-delete |

### D4 — Controlled purge RPC is the only lineage-clearing path

**Decision:** Add service-only `purge_document_derived_observation_lineage(p_document_id uuid)` (name may vary) that, in one transaction:

1. Locks affected laboratory observations and extracted biomarker rows for the document.
2. Sets `normalization_revision_id = NULL` and `source_extracted_biomarker_id = NULL` together on retained observations (sole bypass of provenance write-once for this pair).
3. Deletes `document_extracted_biomarkers` for the document (revisions cascade or delete explicitly).
4. Does not delete the observation row itself (retains user-visible history shell if product already does) unless current document-delete semantics already remove observations via FK—match existing product behavior for observation retention vs cascade, but **never** leave a half-link.

Wire `DELETE /api/documents/:id` (admin client) to call this RPC **before** `documents.delete`, or fold document delete into a broader service RPC if cascade order requires it.

Block direct `DELETE` on `observation_normalization_revisions` for non-superuser/service purge paths (revoke table delete from authenticated; optional trigger raising on direct delete when not in purge context via `set_config` local flag).

**Why:** Phase A document delete relies on `ON DELETE SET NULL` and plain `documents.delete`. That cannot survive `MATCH FULL`.

**Alternatives considered:**

| Option | Rejected because |
| --- | --- |
| App-level multi-statement delete without RPC | Non-atomic; race with promotion |
| Cascade-delete observations with documents | Changes product retention semantics beyond Phase B scope unless already true |

### D5 — Drop legacy promote RPC only after a static caller ban

**Decision:**

1. Grep/static script asserts zero references to `promote_observation_normalization_revision(` outside historical migrations and the drop migration itself.
2. Phase B migration `DROP FUNCTION public.promote_observation_normalization_revision(uuid, uuid, uuid)`.
3. Update Phase A fixtures that currently assert service_role still has legacy execute—replace with “function absent” assertions in the Phase B suite.

**Why:** EH-106 claim is that all writers use v2; Phase B makes that structurally true.

### D6 — Final extracted `resolver_result` constraint

**Decision:** After clean preflight, add CHECK (or equivalent) on `document_extracted_biomarkers.resolver_result`:

- `NULL` allowed (pre-resolution)
- else only `resolved|partial|ambiguous|unmapped`

Do not force non-null on extracted rows.

**Why:** Phase A deferred this so legacy extracted values could exist until writers were clean.

### D7 — Fixture strategy

**Decision:** Extend `supabase/tests/eh104_observation_resolution_verification.sql` **or** add sibling `eh104_phase_b_enforcement.sql` invoked by the same `pnpm test:eh104-db` (or `test:eh104-db` runs both). Prefer a second file if the Phase A file’s temporary guard-attach/detach pattern becomes unreadable.

Phase B fixtures MUST cover:

- guard rejects bad pending/verified metadata on INSERT and UPDATE
- verified incomplete rejected
- composite FK / MATCH FULL rejects half-links and source mismatches
- controlled purge yields full null pair
- direct revision delete denied
- legacy promote function absent / non-executable
- preflight abort path documented via script tests where SQL cannot model env policy
- clean path: v2 promote + EH-106 writer still succeed

### D8 — QA and issue hygiene in-scope

**Decision:** Update `QA/eh-104/checklist.md` for Phase B developer evidence and close criteria for GitHub #4. Manual UI checks stay thin (Phase B is mostly DB); developer evidence is the release gate.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| Dirty retained staging/prod data blocks enforcement | Preflight diagnostics; no silent repair; only disposable reset |
| Document delete breaks under MATCH FULL | Purge RPC before delete; pgTAP for delete/purge path |
| Worker reprocess deletes extracted rows and half-links observations | Audit worker `clearPriorExtractions` / lab observation clear against new FKs; use purge helper or ordered clears |
| Legacy promote still referenced in a script | Static ban in CI before drop |
| Guard blocks legitimate EH-106 writes | Fixture matrix mirrors EH-106 decision metadata mapping |
| Instrumental rows accidentally enter lab FK | Keep both lab lineage columns null for instrumental; existing EH-105 checks |
| Local Docker absent | CI `database` job remains source of truth; document limitation in QA |

**Trade-off:** Stricter DB means disposable environments must reset more often during development. Acceptable pre-launch; cheaper than dual-runtime or silent repair.

## Migration Plan

1. **Code prep (no enforcement yet)**
   - Static ban on legacy promote callers.
   - Implement purge RPC + document DELETE wiring behind feature that still works with current FKs *or* ship RPC in same migration as FK swap carefully ordered.
   - Extend preflight CLI to exit non-zero on findings; print codes from `eh104_resolution_verification_preflight`.

2. **Gate**
   - Run `pnpm preflight:eh104` against target DB.
   - Persistent + findings → stop.
   - Disposable + allow-reset → controlled reset of document-derived laboratory lineage only → preflight again.

3. **Enforcement migration** (clean DB only)
   - Attach revision verification triggers.
   - Add extracted resolver_result domain check.
   - Drop old observation→revision FK; add composite MATCH FULL FK.
   - Install revision append-only / direct-delete denial.
   - Install purge RPC grants (`service_role` only).
   - Drop legacy promote function.
   - Optionally tighten observation write-once trigger to allow lineage pair clear only when `current_setting('easyhealth.purge_lineage', true) = 'on'` set inside purge RPC.

4. **Verify**
   - `supabase db reset` + `pnpm test:eh104-db` (+ eh106/eh105 regression).
   - `pnpm typecheck` / focused API tests for document delete.
   - Update QA checklist + issue #4.

5. **Rollback**
   - Forward-only preferred. Rollback = restore previous migration pair only in disposable envs.
   - Do not reintroduce legacy promote in production once dropped; if emergency needed, restore from migration history in a hotfix with explicit approval.

## Open Questions

None blocking. Confirmed by Phase A design and EH-106 delivery notes:

- Reviewed maturity stays trusted-service, not SQL catalog mirror.
- `rejected` remains EH-120, not a verification status.
- Scoring eligibility unchanged.
- Persistent vs disposable reset policy is mandatory and explicit.
