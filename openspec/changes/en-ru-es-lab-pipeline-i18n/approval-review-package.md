# Approval review package — EN + RU + ES lab pipeline

Prepared for the release owner. **No approval file was modified.**
`registry/candidate-release/v1/approvals.json` is untouched: no `approvedBy`,
timestamp, signature, note, hash or decision was written on your behalf.

Regenerate every number below with:

```bash
npx tsx scripts/registry-v2-candidate-corpus.ts --input-hash
npx tsx scripts/registry-v2-candidate-corpus.ts --report
npx tsx scripts/registry-v2-candidate-corpus.ts --technical-check
```

**Post option B.** The versioned persisted trace (schema 1 frozen, schema 2 for
new decisions) is implemented and verified. It did **not** move the candidate
input hash: none of the six hashed inputs, the catalog digest, the resolver
version or the normalization version changed. Section 11 records the evidence.

---

## 1. Final candidate input hash

```
adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c
```

Verified stable across two consecutive runs. Report hash for the same inputs:
`12ca36dbdb63192feacadae6bf38f7204073da8582ec09bcc91d06ffb2a688be`.

The hash will move again if — and only if — one of the inputs in section 3
changes. Recording approvals does not (section 8).

## 2. Previous and new hash

| | Hash |
|---|---|
| Previous (`HEAD`, `ae2fe70`, bound to the seven existing approvals) | `1ef42fbeb5152fec2c6c1de51e0a86ff68ed9cfc80c5555d002f87d7d0c08c03` |
| New (this change) | `adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c` |

The previous hash was confirmed by running the corpus in a clean detached
worktree at `HEAD` (`git worktree add --detach <path> HEAD`), which reported
`launchable: true` and `approvalErrors: 0`. That worktree has been removed.

An intermediate hash `191352c1…5166d0b` existed earlier in this review and is
superseded: removing the unreachable `crp_serum` owner from `policy.json` moved
the policy input. No approval was ever signed against it.

## 3. Exactly which inputs moved the hash

`candidateInputHash` covers `corpus.candidate`, the six input hashes below,
`catalogManifestVersion`, `resolverVersion` and `normalizationVersion`
(`scripts/lib/registry-v2-candidate-corpus.ts`, `candidateInputHash` /
`buildInputHashes`).

| Input | Before | After | Changed | Why |
|---|---|---|---|---|
| `corpus` | `fbbf5ee3…` | `eee05d21…` | **yes** | 53 → 72 rows: 33 English rows re-pointed from RU documents to EN documents, plus 19 localized rows (17 recognizable + 2 unknown-marker) |
| `documentIndex` | `6d5b5a6f…` | `7764ff3a…` | **yes** | `languages` now `en, ru, es`; three fixtures registered (`cbc-en-north`, `chemistry-es-iberia`, `cbc-es-latam`) |
| `documentFixtures.cbc-ru-north` | `64df4d96…` | `82775c13…` | **yes** | English labels replaced with pure Cyrillic rows |
| `documentFixtures.specialty-ru-central` | `c76674a1…` | `dba7361f…` | **yes** | English labels replaced with pure Cyrillic rows |
| `documentFixtures.cbc-en-north` | — | `a516f91a…` | **new** | Receives the English CBC rows previously mis-filed as Russian |
| `documentFixtures.chemistry-es-iberia` | — | `e0d1a6ca…` | **new** | Spanish biochemistry fixture |
| `documentFixtures.cbc-es-latam` | — | `c4c79a6d…` | **new** | Spanish CBC fixture |
| `documentFixtures.chemistry-en-west` | `20eb8903…` | `20eb8903…` | no | untouched |
| `documentFixtures.glucose-en-review` | `9706b42b…` | `9706b42b…` | no | untouched |
| `documentFixtures.specialty-en-central` | `3c6eab83…` | `3c6eab83…` | no | fixture file untouched (it gained corpus rows, which live in `corpus`) |
| `policy` | `945a59e3…` | `f36a97c1…` | **yes** | `requiredLaunchRows` 53 → 72; new `languageThresholds` block; `scoreAffectingBindingOwners` extended to the 13 reached definitions and the unreachable `crp_serum` entry removed |
| `resetRollbackNotes` | `d35a5c00…` | `a8d1f96a…` | **yes** | New "Multilingual candidate" section documenting the hash move and the re-approval requirement |
| `registryManifest` (catalog digest) | `5341c12e…` | `0958b279…` | **yes** | Alias `normalizedValue` recomputed with `normalizeMeasurementLabel`; `locale` now required on every alias; reviewed RU/ES alias packs added to the launch slice |
| `catalogManifestVersion` | `2026-08-03.0` | `2026-08-09.0` | **yes** | Catalog release marker |
| `resolverVersion` | `10` | `11` | **yes** | Alias admission uses measurement-label normalization; collision-gated ES accent-fold fallback |
| `normalizationVersion` | `6` | `7` | **yes** | New label-normalization contract (identifier `snakeCaseToken` unchanged) |

No approval file, QA file, OpenSpec artifact or application source outside the
catalog digest participates in the hash.

## 4. Corpus and per-language metrics, before and after

### Aggregate

| Metric | Before (53 rows) | After (72 rows) |
|---|---|---|
| `rawPreservationRate` | 1 | 1 |
| `recognitionRate` | 1 | 1 |
| `expectedClassificationRate` | 1 | 1 |
| `aliasCoverageRate` | 1 | 1 |
| `unitCoverageRate` | 1 | 1 |
| `resolved` | 8 | 23 |
| `partial` | 45 | 47 |
| `ambiguous` | 0 | 0 |
| `unmapped` | 0 | 2 (both deliberate unknown markers) |
| `falseConcreteResolutions` | 0 | 0 |
| `processingErrors` | 0 | 0 |
| `unclassifiedRows` | 0 | 0 |
| threshold checks | 8 | 17 (8 aggregate + 9 per-language) |

`recognitionRate`, `aliasCoverageRate` and `unitCoverageRate` are now scored over
rows the corpus **expects** to be recognized. The two unknown-marker rows are
excluded from those denominators by design and are policed instead by
`expectedClassificationRate = 1` and `falseConcreteResolutions = 0`. Without this
scoping a corpus can never contain a deliberate unknown.

### Per language

| Language | Before | After |
|---|---|---|
| `en` | 20 rows · resolved 7 · partial 13 · unmapped 0 · failures 0 · false-concrete 0 | 53 rows · resolved 8 · partial 45 · unmapped 0 · failures 0 · false-concrete 0 |
| `ru` | 33 rows · resolved 1 · partial 32 · unmapped 0 · failures 0 · false-concrete 0 — **but 0 rows contained Cyrillic text** | 9 rows · resolved 6 · partial 2 · unmapped 1 · failures 0 · false-concrete 0 — **9/9 rows contain Cyrillic** |
| `es` | not present | 10 rows · resolved 9 · partial 0 · unmapped 1 · failures 0 · false-concrete 0 — 2 rows carry Spanish diacritics |

The `en` segment grew from 20 to 53 rows because the 33 English rows that were
previously counted as Russian coverage are now filed under English documents.
No English row changed its label, unit, value, expected classification or
outcome.

### Rows per document

| Document | Before | After |
|---|---|---|
| `chemistry-en-west` | 8 | 8 |
| `glucose-en-review` | 9 | 9 |
| `specialty-en-central` | 3 | 8 |
| `cbc-en-north` | — | 28 |
| `cbc-ru-north` | 28 (English labels) | 5 (Cyrillic) |
| `specialty-ru-central` | 5 (English labels) | 4 (Cyrillic) |
| `chemistry-es-iberia` | — | 6 |
| `cbc-es-latam` | — | 4 |

## 5. Safety confirmations

| Claim | Evidence | Status |
|---|---|---|
| Expected classification failures remain zero | `expectedClassificationFailures = 0` in every language segment; `expectedClassificationRate = 1` | ✅ |
| False concrete resolutions remain zero | `falseConcreteResolutions = 0` aggregate and per language; `language.<l>.falseConcreteResolutions <= 0` gate passes for `en`, `ru`, `es` | ✅ |
| Unknown biomarkers remain unmapped | Rows `ru-unknown-marker`, `es-unknown-marker` → `unmapped`, `classificationMatches = true`; `verify-multilingual-lab-pipeline` asserts unknown labels in all three languages resolve `unmapped` with null analyte and null definition, and that `MEASUREMENT_DEFINITIONS.length` is unchanged after resolving them | ✅ |
| Ambiguous matches are not auto-accepted | `ambiguous = 0` in the corpus (no ambiguous row currently fires); the resolver contract is asserted separately — a soft-assist-only input returns non-`resolved` with a null definition key | ✅ |
| Existing English corpus has not regressed | All 53 English rows keep their labels, units, values, expected classifications and outcomes; `en` segment failures 0; `verify-registry-v2-candidate-corpus-runner`, `verify-cbc-measurement-regression-runner` (48/48), `verify-alias-order-insensitivity` (26 labels), `verify-eh113-cbc-launch-catalog` all pass | ✅ |
| All technical checks pass | `--technical-check` exit 0; `npx tsc --noEmit` exit 0; 26 verifier scripts pass (list in section 10) | ✅ |

## 6. Proposed approval entries — **not written**

The full, unabridged JSON lives in one place so the package and the file cannot
drift apart:

```
registry/candidate-release/v1/approvals.proposed.json
```

`registry/candidate-release/v1/approvals.json` (production) is untouched.

The reached score-affecting binding set grew from **5** to **13** because RU and
ES rows now resolve to real measurements, so the gate needs **15** approvals:
the two release-wide scopes plus one per reached binding. Every entry carries
`"approvedBy": ""` and
`candidateInputHash = adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c`.

| # | id | scope | bindingKey | Change vs current approvals.json |
|---|---|---|---|---|
| 1 | `registry-safety-review-2026-08-10` | `false_concrete_review` | — | hash + note rewritten (corpus 53→72 decomposition) |
| 2 | `release-gate-2026-08-10` | `release_gate` | — | hash + note rewritten (metrics, policy changes, known failures, governance note) |
| 3 | `assessment-alt-serum-catalytic-activity-review-2026-08-10` | `score_affecting_binding` | `alt_serum_catalytic_activity` | hash only; reach unchanged (manual correction) |
| 4 | `assessment-fasting-glucose-review-2026-08-10` | `score_affecting_binding` | `fasting_glucose` | hash only; reach unchanged |
| 5 | `assessment-glucose-plasma-review-2026-08-10` | `score_affecting_binding` | `glucose_plasma` | hash only; reach unchanged |
| 6 | `assessment-glucose-serum-review-2026-08-10` | `score_affecting_binding` | `glucose_serum` | hash + reach widened by `es-glucosa-suero` |
| 7 | `assessment-glucose-whole-blood-review-2026-08-10` | `score_affecting_binding` | `glucose_whole_blood` | hash only; reach unchanged |
| 8 | `assessment-hemoglobin-whole-blood-review-2026-08-10` | `score_affecting_binding` | `hemoglobin_whole_blood` | **new** — `ru-hgb-cyrillic`, `es-hemoglobina-mixed-code` |
| 9 | `assessment-wbc-whole-blood-review-2026-08-10` | `score_affecting_binding` | `wbc_whole_blood` | **new** — `ru-wbc-cyrillic`, `es-leucocitos` |
| 10 | `assessment-platelets-whole-blood-review-2026-08-10` | `score_affecting_binding` | `platelets_whole_blood` | **new** — `es-plaquetas-mixed-code` |
| 11 | `assessment-tsh-serum-review-2026-08-10` | `score_affecting_binding` | `tsh_serum` | **new** — `ru-tsh-cyrillic` |
| 12 | `assessment-free-t4-serum-review-2026-08-10` | `score_affecting_binding` | `free_t4_serum` | **new** — `ru-free-t4-cyrillic` |
| 13 | `assessment-creatinine-serum-review-2026-08-10` | `score_affecting_binding` | `creatinine_serum` | **new** — `es-creatinina` |
| 14 | `assessment-triglycerides-serum-review-2026-08-10` | `score_affecting_binding` | `triglycerides_serum` | **new** — `es-trigliceridos-accented`, `es-trigliceridos-ocr-no-accent` |
| 15 | `assessment-hba1c-whole-blood-review-2026-08-10` | `score_affecting_binding` | `hba1c_whole_blood` | **new** — `es-hba1c` |

`crp_serum` is deliberately absent: `ru-crp-cyrillic` resolves to it, but its
assessment binding is `scoreRole: "display"`, which the corpus runner filters out
of `assessmentImpact`, so it is not score-affecting and no approval is demanded.
Its stale owner entry was removed from `policy.json` in this candidate.

## 7. Owner-controlled procedure to record the approvals

Nothing here is automated on your behalf.

1. Confirm the hash yourself:
   ```bash
   npx tsx scripts/registry-v2-candidate-corpus.ts --input-hash
   # expect adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c
   ```
2. Read the evidence you are signing:
   ```bash
   npm run report:registry-v2-candidate-corpus
   ```
3. Edit `registry/candidate-release/v1/approvals.json` yourself, replacing the
   `approvals` array with the 15 entries from section 6 and substituting
   `<APPROVER>` with your name. Keep `"schemaVersion": "1"`.
4. Verify the gate closes:
   ```bash
   npx tsx scripts/registry-v2-candidate-corpus.ts --check   # expect exit 0, launchable true
   ```
5. Re-confirm the hash did not move (section 8):
   ```bash
   npx tsx scripts/registry-v2-candidate-corpus.ts --input-hash
   ```

If you prefer, tell me the approver name and I will prepare the file content for
you to paste — I will still not write it without your explicit instruction.

## 8. Recording approvals cannot move the hash

`buildInputHashes` covers `corpus`, `documentIndex`, `documentFixtures`,
`policy`, `resetRollbackNotes` and `registryManifest`. `approvals.json` is read
separately into `approvalEvidenceHash` and is **not** an input to
`candidateInputHash`.

Proven empirically on a throwaway copy of the release directory: mutating
`approvals[0].note`, `approvals[0].approvedBy` and even
`approvals[0].candidateInputHash`, then re-running `--input-hash`:

```
before mutation: adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c
after  mutation: adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c
```

The throwaway copy was deleted; the real `approvals.json` was never touched.

## 9. Diff restricted to release inputs, by approval scope

Changed files under `registry/candidate-release/v1` (the only release inputs):

```
 M corpus.json                          +362 / -43 lines
 M documents.json                       +7 / -2
 M documents/cbc-ru-north.json          +7 / -2
 M documents/specialty-ru-central.json  +8 / -3
 M policy.json                          +19 / -3
 M reset-rollback.md                    +23 / -0
 ?? documents/cbc-en-north.json         new
 ?? documents/cbc-es-latam.json         new
 ?? documents/chemistry-es-iberia.json  new
```

| Approval scope | Inputs it covers | What changed inside that scope |
|---|---|---|
| `false_concrete_review` (registry-safety-reviewer) | `corpus.json`, all document fixtures, catalog digest | 33 English rows re-pointed to EN documents (content byte-identical); 18 new RU/ES rows; 2 new expected-`unmapped` rows; catalog digest moved because alias normalized forms and locales changed. False-concrete count stays 0. |
| `score_affecting_binding` · `alt_serum_catalytic_activity`, `fasting_glucose`, `glucose_plasma`, `glucose_whole_blood` | the English rows that reach them | **No change.** Same rows, same provenance, same outcomes. Signature refresh only. |
| `score_affecting_binding` · `glucose_serum` | `glucose`, `glucose-specimen-by-section`, **new** `es-glucosa-suero` | One Spanish row added that states its specimen on the row. |
| `score_affecting_binding` · 8 new keys | the new RU/ES rows listed in each note | Each key is reached only by rows added in this change. |
| `release_gate` (release-manager) | everything above plus `policy.json` and `reset-rollback.md` | Row count 53 → 72; per-language thresholds added; eight binding owners named; reset/rollback notes document the hash move and re-approval requirement. |

Application source outside `registry/candidate-release/v1` affects the release
inputs only through `registryManifest` (the catalog digest), which is listed in
section 3.

## 10. Verification state and remaining known failures

The affected CI and database contracts were re-run on 2026-08-11 after
resetting the local schema through migration `049`. The canonical workflow
database job now runs the 12 contracts below; all passed:

**12 of 12 affected pgTAP contracts (242 assertions):**
`eh104_observation_resolution_verification` 42,
`eh105_instrumental_observation_lineage` 16,
`eh106_atomic_observation_normalization_writer` 38,
`postgrest_revision_embed_alias` 8,
`eh111_clinical_compatibility` 14,
`eh114_glucose_resolution_persistence` 7,
`alias_token_set_trace_code` 5,
`stated_axis_inferred_axes` 6,
`resolver_trace_v2_alias_evidence` 26,
`eh119_observation_measurement_correction` 39,
`eh118_observation_source_region` 26, and
`writer_rpc_seam` 15.

Additional repository database contracts also pass:
`eh113_cbc_method_evidence` 5 and `eh116_registry_reprocess_batches` 42.
`test:eh115-db` is the compatibility alias of the EH-106 contract and passes
the same 38 assertions.

The following unrelated checks remain outside the affected CI gate:

| Check | Current result | Related? |
|---|---|---|
| `pnpm test:eh111` — `verify-eh111-clinical-compatibility.ts:184` expects a `unit_dimension_conflict` | fails with the pre-existing assertion; the same failure is recorded in issue #110 and `QA/issue-114/checklist.md` | **No** |
| `pnpm test:pr2-db` — `pr2_instrumental_canonicalization.sql` test 6 | expects SQLSTATE `23503`, receives `23514` from `document_instrumental_publications_attempt_presence`; the instrumental publication path is untouched | **No** |
| `pnpm test:postgrest-embeds` | requires a live full Supabase/PostgREST target; the local pgTAP embed contract passes | **No** |

No candidate-release approval was written. No GitHub Issue or remote Wiki page
was modified.
---

## 11. Option B: versioned persisted trace

### What changed

| Artifact | Change |
|---|---|
| `src/lib/biomarkers/types.ts` | `ResolverTraceSchemaVersion = "1" \| "2"`; `PersistedResolverDecisionTraceV1` / `V2` and a discriminated `PersistedResolverDecisionTrace`; `PersistedResolverDecisionTraceAliasEvidence` |
| `src/lib/biomarkers/measurement-resolution.ts` | `RESOLVER_DECISION_TRACE_SCHEMA_VERSION = "2"` (written) with `SUPPORTED_RESOLVER_DECISION_TRACE_SCHEMA_VERSIONS = ["1","2"]` (read); zod discriminated union, v1 branch unchanged; builder emits alias evidence |
| `src/lib/documents/observation-normalization-writer.ts` | `assertTraceMatchesResolverEvidence` refuses a payload whose `resolver_evidence` disagrees with the trace |
| `src/lib/documents/normalization-review.ts` | reader accepts column version `"1"` or `"2"` |
| `supabase/migrations/048_resolver_trace_v2_alias_evidence.sql` | validator accepts `'1'` (body identical to migration 042) and `'2'` (12 candidate keys); new `eh122_trace_matches_resolver_evidence`; RPC wrapper enforces it |
| `scripts/verify-resolver-trace-v2.ts`, `supabase/tests/resolver_trace_v2_alias_evidence.sql` | executable proof |

Migration number: `048`, not `047` — the local stack already carries
`047_eh121_observation_change_history` from the sibling `eh-121` branch.

### Source of truth

`resolver_decision_trace` (schema 2) is authoritative for alias evidence.
`resolver_evidence` keeps the operational v2 `ResolverDecisionTrace` its existing
readers consume. Both are projected from one in-memory resolution, and
divergence is refused twice: in the writer (`Alias evidence diverges…`) and in
the RPC (`resolver_trace_evidence_divergence`).

### Requirement-by-requirement evidence

| Requirement | Evidence |
|---|---|
| v1 preserved, no backfill | pgTAP 1, 23, 24, 25; TS "an already-stored schema-1 trace still validates", "needs no backfill" |
| v2 introduced | pgTAP 2; TS "new decisions are written as schema 2" |
| locale persisted | pgTAP 16; TS "a Russian match records its locale" |
| laboratory persisted when applicable | validator accepts string-or-null (`aliasLaboratory`), pgTAP 2 |
| fold-fallback persisted | pgTAP 19; TS "a Spanish accent-fold match records the fallback" |
| alias identity sufficient | `aliasKey` + `aliasMatchType` persisted; pgTAP 17 |
| readers accept both | TS "review reader surfaces a stored schema-1/schema-2 trace" |
| new writes v2, v1 immutable | pgTAP 14, 15, 22 |
| DB round-trip without loss | pgTAP 16, 17, 19, 20, 26 |
| RU and ES round-trip | pgTAP 14–20; TS RU/ES checks |
| malformed / unsupported rejected | pgTAP 3–7; TS "unsupported schema version", "missing alias evidence", "schema-1 carrying alias evidence", "unsupported alias locale" |
| immutability enforced | pgTAP 22 |
| no divergent copies | pgTAP 8–13, 21; TS "writer payload carries consistent alias facts", "divergent payload is refused" |

### Hash impact

None. `candidateInputHash` covers corpus, documentIndex, documentFixtures,
policy, resetRollbackNotes, registryManifest digest, catalog manifest version,
resolver version and normalization version. Option B changed none of them:
the trace schema has its own version, and resolver selection behaviour is
unchanged (`MEASUREMENT_RESOLVER_VERSION` stays `11`, normalization stays `7`,
catalog digest stays `0958b279…`).

Re-measured after option B:

```
npx tsx scripts/registry-v2-candidate-corpus.ts --input-hash
adc0018681b017d2cef0c3750916198b4ced2066f92fcea64a3e6a1e851a465c   (unchanged)
--technical-check → exit 0
```

Approvals-independence re-proven after option B on a throwaway copy: mutating
`approvals[0].note`, `approvedBy` and `candidateInputHash` left the hash at
`adc00186…851a465c`.

### Dependency state after the `node_modules` incident

| Check | Result |
|---|---|
| `pnpm-lock.yaml` modified? | No — `git status` clean for that path before and after reinstall |
| Reproducible from a clean install? | `pnpm install --frozen-lockfile` succeeds and leaves the lockfile untouched |
| Tracked files removed? | `git ls-files --deleted` is empty |
| Tracked files unintentionally modified? | No unrelated tracked file is part of the canonical PR correction set |
| Verification run from the restored state? | Yes — every result in sections 10 and 11 was produced after `pnpm install --force` restored the store |

---

# Task 6.5 — compliance analysis (resolved by option B)

## 6.5.1 Exact wording and acceptance criteria

`tasks.md`, section 6:

> - [x] 6.5 Decision-trace fields record alias locale and match mode (including fold-fallback when used)

Spec obligations it implements:

- `specs/context-aware-measurement-resolution/spec.md`, *Authoritative candidate
  generation*: "Each generated candidate SHALL record the label authority
  identifier, match type, approval state, provenance, **locale when present on
  the alias**, and fixture references."
- `specs/measurement-alias-authority/spec.md`, *Laboratory scope SHALL constrain
  alias matching*: "**WHEN** the resolver admits an alias **THEN** candidate
  evidence retains the alias locale for audit and release reporting."
- `specs/multilingual-measurement-labels/spec.md`, *Optional Spanish accent-fold
  fallback*: "admission MAY use fold-fallback and **MUST record that the match
  used the fallback policy**."

Read literally, the criteria are stated against **candidate evidence**, not
against the allowlisted `resolver_decision_trace`. The task title says
"Decision-trace fields", which is ambiguous between the two artifacts. This
analysis reports both.

## 6.5.2 Where the fields exist at runtime

| Field | Type | Location |
|---|---|---|
| `locale` | `AliasDefinition["locale"]` | `src/lib/biomarkers/types.ts` — added to the `MatchedAlias` `Pick` |
| `laboratory` | `AliasDefinition["laboratory"]` | same `Pick` |
| `foldFallback` | `boolean \| undefined` | `src/lib/biomarkers/types.ts`, `MatchedAlias` |
| fired match mode | `AliasMatchType` | `matchAliasMode` now returns `{ matchType, foldFallback }`; `findAliasAdmissions` writes both onto the admitted alias (`src/lib/biomarkers/measurement-resolution.ts`) |
| carrier | `CandidateEvidence.matchedAlias` | `src/lib/biomarkers/types.ts` |

Observed output for the unaccented Spanish label:

```
outcome: resolved triglycerides_serum
triglycerides_serum: locale=es matchType=normalized foldFallback=true value="triglicéridos"
```

## 6.5.3 Is this evidence persisted and auditable?

**Yes — schema 2 carries alias evidence in `resolver_decision_trace`, while
`resolver_evidence` retains the operational candidate evidence.**

- `observation-normalization-writer.ts` projects both fields from the same
  in-memory resolution and `assertTraceMatchesResolverEvidence` rejects
  divergence before the RPC call.
- `resolver_decision_trace` stores `aliasKey`, `aliasMatchType`, `aliasLocale`,
  `aliasLaboratory` and `aliasFoldFallback` for each schema-2 candidate.
- `resolver_evidence` remains the full `ResolverDecisionTrace` consumed by
  existing readers. Migration `048` adds the database cross-check
  `eh122_trace_matches_resolver_evidence`.
- `normalization-review.ts` accepts schema 1 and schema 2; schema-1 rows remain
  readable without backfill and schema-2 rows surface the persisted alias
  evidence.

## 6.5.4 Every consumer of `isPersistedResolverDecisionTrace`

| Consumer | Use |
|---|---|
| `src/lib/biomarkers/measurement-resolution.ts` (`buildPersistedResolverDecisionTrace`) | Self-check before returning a freshly built trace; throws "Resolver decision trace is not canonical" |
| `src/lib/biomarkers/index.ts` | Re-export only |
| `src/lib/documents/normalization-review.ts:263-265` | Read guard accepts schema version `"1"` or `"2"` and validates the stored trace |
| `scripts/verify-measurement-registry-runner.ts` | Asserts a canonical trace passes and a non-canonical one fails |

Database-side equivalent: `public.eh115_validate_resolver_decision_trace`
(migration 048) accepts schema 1 and schema 2, while the immutability trigger
`eh115_enforce_resolver_decision_trace` keeps persisted traces unchanged.

## 6.5.5 Could an additive/versioned trace change stay compatible?

Measured, not assumed:

```
guard accepts current trace:              true
guard accepts additive candidate field:   false
guard accepts additive top-level field:   false
```

The TypeScript guard is `z.object(...).strict()` with
`schemaVersion: z.literal("1")`, and the SQL validator counts keys. So a purely
additive field is rejected by both today — a **version-aware** change is
required. It is, however, entirely feasible without invalidating stored traces:

**Compatibility design considered before implementation:**

1. Keep `RESOLVER_DECISION_TRACE_SCHEMA_VERSION = "1"` as the *minimum readable*
   version and introduce `"2"` as the *written* version.
2. Replace the strict object with a discriminated union on `schemaVersion`:
   `z.discriminatedUnion("schemaVersion", [traceV1Strict, traceV2Strict])`.
   `isPersistedResolverDecisionTrace` accepts both, so every trace already stored
   under `"1"` keeps validating and keeps rendering in review.
3. `traceV2` adds, per candidate, the optional-in-v1/required-in-v2 fields
   `aliasLocale`, `aliasMatchType`, `aliasFoldFallback` — catalog-derived values,
   no raw patient text, so the privacy contract is preserved.
4. Migration `0NN_eh115_trace_v2.sql`: `create or replace` the validator to
   branch on `p_schema_version in ('1','2')` with the v1 branch byte-identical to
   today's body (the migration-042 precedent: widening is additive and every
   previously persisted trace stays valid). The immutability trigger is
   unchanged, so historical rows are never rewritten.
5. `normalization-review.ts` drops the hard-coded
   `resolver_trace_schema_version === "1"` comparison in favour of the guard.
6. Regression: assert a stored v1 fixture still passes the guard and still
   renders, and that a v2 trace round-trips through the SQL validator.

**Outcome: option B was chosen and implemented.** Steps 1-6 above are done, with
one deviation worth naming: the written version is `"2"` and the *readable* set
is `["1", "2"]`, expressed as `SUPPORTED_RESOLVER_DECISION_TRACE_SCHEMA_VERSIONS`
rather than by keeping the written constant at `"1"`. Every stored `"1"` trace
still validates, still renders in review, and is never rewritten — proven by
pgTAP 1, 23, 24 and 25 and by the TypeScript guard checks.

See section 11 for the full artifact list, the requirement-by-requirement
evidence table, and the confirmation that the candidate input hash did not move.
