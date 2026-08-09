## Context

Registry 2.0 carries two semantic identity links on every laboratory
observation and normalization revision: `analyte_key` ("this measures ALT") and
`measurement_definition_key` ("this is ALT, serum, catalytic activity"). They are
not the same claim and they are not earned at the same threshold.

Four layers implement the relationship between those links and
`resolution_status`, and they do not agree:

| Layer | `measurement_definition_key` | `analyte_key` |
| --- | --- | --- |
| `measurement-resolution.ts:921-923` | null unless `resolved` | emitted when candidates converge on one analyte |
| `observation-identity.ts:46-48` | gated on `resolved` | passed through ungated |
| `observation-normalization-writer.ts:308-309` | passed through | passed through |
| `033:258` / `045:134` (promotion primitive) | null unless `resolved` | **null unless `resolved`** |

Three layers implement a two-tier model. The primitive implements a one-tier
model. The specifications side with the three: `context-aware-measurement-resolution`
gates only the definition key, and `observation-identity` tells consumers they
may "accept analyte-level partial data". Four verification runners assert the
two-tier behaviour by name.

The disagreement was invisible until now. Acceptance had never committed a row —
every write failed earlier, on `invalid_normalization_resolution_payload`, which
`fix-writer-rpc-payload-seam` repaired. The first successful acceptance run
exposed the next guard down: `207 Multi-Status`, 18 rows committed, the rest
rejected with `incomplete_normalization_cannot_have_concrete_identity`.

The rejected population is not marginal. It is rows the resolver understood at
analyte level but could not pin to a definition, overwhelmingly because the
specimen axis was not stated. `add-reviewed-panel-specimen-policy` records 44 of
44 rows in that state on the sample document. An `unmapped` row, where the
system knows nothing, accepts cleanly; the more the resolver knows, the more
likely acceptance fails.

## Goals / Non-Goals

**Goals:**

- Acceptance commits a recognized incomplete row instead of rejecting it.
- One reading of "governed by `resolution_status`" exists, stated in a
  specification, implemented identically by resolver, writer, and primitive.
- The analyte tier is derived only from evidence the resolver did not already
  reject.
- The seam is covered by a test that submits the writer's real payload to the
  deployed primitive, not a hand-built equivalent.

**Non-Goals:**

- Changing the read-side projection. `incomplete-laboratory-outcomes.ts:241-243`
  nulls `analyteKey` unless the binding is ready; that is EH-112 reviewer
  display policy, asserted at `verify-eh112-incomplete-outcomes.ts:136`, and it
  is a different contract from persisted identity.
- Changing which rows resolve. This change does not add candidates, aliases,
  definitions, or axis policies. Rows that were `partial` stay `partial`; they
  become acceptable rather than resolvable.
- Making incomplete rows eligible for trends, assessment, or scoring.
  `registryBindingReady` still requires `resolved` and still gates every
  consumer.
- Backfill. No stored revision violates either the old or the new rule.

## Decisions

### Relax the guard rather than strip the analyte in the resolver

Three positions were available.

**A — strip `analyteKey` unless `resolved`.** No migration; the resolver would
match the primitive. Rejected: it deletes a claim the resolver is entitled to
make, contradicts the two specifications above, and breaks four verification
runners that assert the behaviour deliberately
(`verify-measurement-registry-runner.ts:73` — "recognized incomplete evidence
preserves analyte-level identity without selecting a concrete definition";
`verify-eh113-cbc-launch-catalog.ts:41`;
`verify-observation-provenance-runner.ts:107-109`). Those assertions are not
incidental — they were written to protect exactly the behaviour A removes.

**B — relax the guard to gate only the definition key.** Chosen. One layer
changes and it is the layer that disagrees with everything else, including the
specifications it is supposed to enforce.

**C — move the analyte hint into the decision trace.** The trace already
carries `candidates[]`, so nothing would be lost outright. Rejected: it makes an
indexed, queryable column into a JSON traversal for every consumer, and
`observations_profile_analyte_identity` (`025:65-67`) exists precisely to make
analyte-scoped lookup cheap. It solves a naming disagreement by degrading a data
model.

### Narrow the analyte derivation to selectable candidates

`measurement-resolution.ts:914-918` builds the analyte set from `candidates` —
every generated candidate, including ones a hard conflict already made
non-selectable. A numeric glucose collects the urine-dipstick definition it was
never going to match, and that definition's analyte participates in the
convergence test.

Today the guard masks this: the derived analyte is rejected before it can be
stored. Relaxing the guard without narrowing the derivation would begin
persisting an identity partly determined by candidates the resolver ruled out.
The two halves are therefore one change, not two.

The set becomes `ranked` (`measurement-resolution.ts:862-864`:
`selectable && score !== null`), not `admissible`. `admissible` additionally
excludes candidates blocked by a missing required axis — which is the defining
condition of the rows this change exists to unblock, so narrowing that far would
null the analyte on precisely the population being fixed and reduce to option A.

Measured against the shipped catalog, the narrowing is a no-op wherever the
input is consistent with the definitions it matches: 584 label × unit × specimen
cases built from each definition's own aliases, accepted units, and declared
value kind produce zero differences in either direction.

The change is observable only when every candidate is hard-conflicted, and it
moves in one direction — the analyte is dropped, never gained. There is no input
in the current catalog where narrowing exposes an analyte that was previously
null; an earlier draft of this design claimed otherwise and was wrong.

The representative case is `urine_glucose` carrying a numeric value. Its only
candidate is `glucose_urine_dipstick`, which is ordinal-only, so a
`value_kind_conflict` makes it non-selectable. Previously the row was `partial`
with analyte `glucose`; now it is `partial` with no analyte. That is the correct
outcome and the reason for the resolver-version bump: the row's own
`incompleteReason` is `unit_or_value_conflict`, so claiming the analyte while
reporting that the only candidate was rejected on value kind was incoherent —
the identity came from the candidate the resolver had just thrown out.

### Version and governance

`MEASUREMENT_RESOLVER_VERSION` moves `9` → `10`.

Two hashes are involved and they behave differently. An earlier draft of this
design conflated them and claimed the approvals survive; measurement shows they
do not.

`digestMeasurementRegistryManifest()` covers definitions alone
(`measurement-registry-release.ts:77-80`). No catalog entry changes, so it stays
at `5341c12e…f7357`.

`candidateInputHash` covers `resolverVersion`
(`scripts/lib/registry-v2-candidate-corpus.ts:713-737`), so the bump moves it
from `f00c0e6f…74efd1` to `1ef42fbe…08c03`. All seven approvals in
`registry/candidate-release/v1/approvals.json` detach with
"bound to a different candidate input hash", and `launchable` becomes false.
This is exactly the path `#105` took for its `8` → `9` bump, and it is the
governance system working, not a defect.

What distinguishes this re-approval from `#105` and `#106` is that nothing
clinical moved. Running the corpus with and without the resolver change produces
byte-identical report rows and identical `thresholdChecks`; only
`candidateInputHash` differs. The reviewers are re-signing the same evidence
under a new resolver version, not judging changed outcomes. The approval records
must still be prepared for the named owners and signed by them — this change
does not synthesise them.

`buildNormalizationWriterRequestHash` includes the decision trace, which carries
`resolverVersion`, so request hashes change. Idempotency keys are per-attempt
and no revision exists that would need to match an old hash.

### Migration shape

Migration `046` uses `create or replace function` on
`write_observation_normalization_revision_v2_legacy`, the delegate, exactly as
`045` did. The EH-115 wrapper `write_observation_normalization_revision_v2`
(`039:232`) is untouched, so grants, signatures, and the trace-allowlist layer
stay as they are. The single edited line:

```sql
-- before
elsif target_definition_key is not null or target_analyte_key is not null then
-- after
elsif target_definition_key is not null then
```

The `resolved` branch (`045:127-133`) is unchanged and still requires both links
plus a reviewed definition, so relaxing the incomplete branch cannot weaken the
concrete-identity invariant.

No table constraint has to move. `observations_instrumental_lineage_check`
(`032:97-112`) forces both links null only for `observation_kind = 'instrumental'`;
`observations_resolution_status_check` (`025:47-49`) constrains the status
vocabulary alone. Nothing ties `analyte_key` to `resolution_status` at table
level.

### Test placement

The new assertions go in `supabase/tests/writer_rpc_seam.sql`, which already
runs in CI and already submits the exact payload
`buildNormalizationResolutionPayload` produces. Two cases:
an incomplete payload carrying an analyte key commits, and an incomplete payload
carrying a definition key is still rejected with the original error. The
existing pgTAP case in `QA-Db_tests/eh111_clinical_compatibility.sql:115-125`
asserts the current one-tier behaviour and must be updated to the two-tier rule
rather than deleted — the concrete-identity half of it is still correct.

## Risks / Trade-offs

**Incomplete rows now carry a queryable analyte key.** Any consumer treating
non-null `analyte_key` as "verified" becomes wrong. Audited: every API surface
overwrites the stored column with the read projection
(`biomarkers/route.ts:122`, `reports/route.ts:190`, `structured-context.ts:247`,
`incomplete-laboratory-outcomes.ts:364`), and that projection nulls the analyte
unless `registryBindingReady`. `reports.ts:181` ships the key alongside
`resolution_status`, `verification_status`, and `registry_binding_ready`, and
`isAbnormalObservation` (`reports.ts:164-166`) already excludes rows that are not
binding-ready. No consumer is left trusting the raw column.

**Reprocessing diff sensitivity.** `registry-reprocessing/diff.ts:161` compares
prior and next analyte keys to classify a row as `unchanged`. Prior comes from
the stored column, next from the resolver. Because the old guard made an
incomplete revision with an analyte impossible, no stored row can disagree with
the new rule; and because the resolver-version bump is recorded on each
revision, a genuine derivation change surfaces as a reprocess diff rather than
silently.

**The `ranked` narrowing removes an analyte from fully conflicted rows.** A row
whose every candidate is hard-conflicted previously carried the analyte of a
candidate the resolver had rejected; it now carries none. That is a real
behaviour change on real input — a laboratory printing a numeric value under a
qualitative-only marker reaches exactly this state. It is the intended
semantics, and it is narrow: zero differences across 584 catalog-faithful cases,
twelve label/unit combinations affected in total, all in the same direction.
Mitigated by the corpus re-run, the version bump, and a named regression case in
`verify-measurement-registry-runner.ts`.

**The guard's original intent may have been broader than the code.** No
specification states the one-tier rule and no scenario asserts it, so the intent
cannot be recovered from the artifacts. Treating it as a defect is the reading
that makes the four verification runners, both specifications, and three of the
four code layers consistent. Recorded here so a future reader sees the judgment
rather than inferring a decision that was never written down.

**Deployment ordering.** Until migration `046` is applied, acceptance keeps
rejecting these rows. The application change alone does not help, and the
resolver narrowing alone does not help either.
