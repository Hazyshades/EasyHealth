## Why

Acceptance now reaches the database — `fix-writer-rpc-payload-seam` cleared the
evidence-shape rejection — but it only half works. On document
`f1410a30-6b94-49d4-8555-877dd4324f12` the API returned `207 Multi-Status`: 18
rows committed, the rest rejected with
`incomplete_normalization_cannot_have_concrete_identity`.

The promotion primitive requires **both** semantic identity links to be null
unless the outcome is `resolved`
(`033_eh106_atomic_observation_normalization_writer.sql:258`, re-emitted
verbatim at `045_writer_rpc_resolver_evidence_shape.sql:134`):

```sql
elsif target_definition_key is not null or target_analyte_key is not null then
  raise exception using message = 'incomplete_normalization_cannot_have_concrete_identity';
```

Every other layer holds a two-tier contract — analyte is a weaker identity tier
than measurement definition, and it survives an incomplete outcome:

- `context-aware-measurement-resolution` / **Safe outcome selection**: "Only
  `resolved` SHALL expose a non-null measurement definition key." It gates the
  definition key and says nothing about the analyte key.
- `observation-identity` / **Downstream consumers declare semantic
  requirements**: consumers may "accept analyte-level partial data".
- `measurement-resolution.ts:922` emits an analyte when every candidate
  converges on one, regardless of outcome.
- `observation-identity.ts:46-48` deliberately gates
  `measurement_definition_key` on `resolved` and deliberately does not gate
  `analyte_key`.
- Four verification runners assert the behaviour by name:
  `verify-measurement-registry-runner.ts:73`,
  `verify-eh113-cbc-launch-catalog.ts:41`,
  `verify-observation-provenance-runner.ts:107-109`,
  `verify-measurement-registry-runner.ts:104`.

The guard is the outlier. It predates the two-tier model and nothing hit it
because acceptance had never committed a row at all.

The failure is not transient: the same rows fail identically on every retry. It
is also inverted — an `unmapped` row (zero candidates, so no analyte) accepts
cleanly, while a `partial` row where the system knows exactly which analyte it
is and only lacks the specimen axis is rejected. Knowing more makes acceptance
fail. This is the population `add-reviewed-panel-specimen-policy` exists to
serve, so the defect grows with the catalog rather than shrinking.

Relaxing the guard alone would be unsafe. `measurement-resolution.ts:914-918`
derives the analyte from `candidates` — the widest set, including candidates the
resolver already made non-selectable through a hard conflict. Today the guard
masks that; removing the guard would persist an analyte identity partly derived
from candidates that were ruled out. Both halves must land together.

## What Changes

- Migration `046` recreates
  `write_observation_normalization_revision_v2_legacy` with the identity guard
  gating only `measurement_definition_key`. A `resolved` outcome still requires
  both links and a reviewed definition; `partial`, `ambiguous`, and `unmapped`
  still reject a concrete definition key. It targets the delegate, not the
  EH-115 wrapper that fronts it, matching `045`.
- The resolver derives the analyte tier from ranked (selectable) candidates
  instead of every generated candidate, so a hard-conflicted candidate can no
  longer contribute an analyte. `MEASUREMENT_RESOLVER_VERSION` moves `9` → `10`.
- **BREAKING for release governance**: `candidateInputHash` is computed over
  `resolverVersion`, so the version bump detaches all seven approvals in
  `registry/candidate-release/v1/approvals.json` and `launchable` becomes false
  until they are re-signed. The hash moves `f00c0e6f…74efd1` → `1ef42fbe…08c03`.
  This is the same governance path `#105` took for its `8` → `9` bump. The
  catalog itself is untouched: `digestMeasurementRegistryManifest()` is stable at
  `5341c12e…f7357`, every corpus report row is byte-identical, and every
  threshold check still passes — the re-approval is a signature refresh, not a
  clinical re-review.
- `supabase/tests/writer_rpc_seam.sql` gains the two cases the seam never
  covered: an incomplete payload carrying an analyte key is accepted, and an
  incomplete payload carrying a definition key is still rejected.
- `QA/eh-119/checklist.md` records the manual and developer evidence.

No table constraint ties `analyte_key` to `resolution_status`;
`observations_instrumental_lineage_check` only forces both links null for
`instrumental` rows. The change is confined to the RPC guard and the resolver.

**Not in scope:** the read-side projection. `incomplete-laboratory-outcomes.ts:241-243`
nulls `analyteKey` unless the binding is ready, which is EH-112 display policy
for reviewers, asserted at `verify-eh112-incomplete-outcomes.ts:136`. It is a
separate contract from persisted identity and stays as it is.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `context-aware-measurement-resolution`: outcome selection states the analyte
  tier explicitly, and the analyte is derived only from candidates that survived
  hard-conflict evaluation.
- `registry-v2-acceptance-correction`: the promotion primitive must persist
  analyte-level identity for a recognized incomplete row while still refusing a
  concrete definition key.
- `observation-identity`: the identity requirement gains the missing middle
  case — recognized analyte, no concrete definition.

## Impact

- Affected domain: health-profile (resolution, acceptance), documents
  (acceptance API surface).
- Affected code: `supabase/migrations/046_incomplete_analyte_identity_gate.sql`
  (new), `supabase/tests/writer_rpc_seam.sql`,
  `src/lib/biomarkers/measurement-resolution.ts`,
  `scripts/verify-measurement-registry-runner.ts`,
  `scripts/verify-eh113-cbc-launch-catalog.ts`,
  `scripts/verify-observation-provenance-runner.ts`.
- **Deployment:** migration `046` must be applied before acceptance stops
  rejecting these rows. Until then the affected rows keep failing.
- **Stored data:** none is invalidated. The guard has always rejected an
  incomplete row carrying an analyte, so no persisted revision violates the new
  rule, and `registry-reprocessing/diff.ts:161` compares prior and next analyte
  keys against a consistent history.
