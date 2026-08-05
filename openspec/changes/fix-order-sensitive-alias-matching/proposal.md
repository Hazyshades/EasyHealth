# Fix order-sensitive alias matching (#105)

## Why

Registry 2.0 admits measurement candidates only through alias matching, and
every alias mode compares an ordered token sequence. When the extractor renders
a parenthetical laboratory label with the abbreviation at the end rather than
the front, matching returns zero candidates and the row collapses to `unmapped`
— even though the analyte is already a reviewed definition with a reviewed
alias. On `lab_data/sample_lab_report_english_mock.pdf`, **12 of 38 printed
labels** flip from a recognised outcome to `unmapped` under that single
reordering, including ALT, AST, ASO, HGB, HCT and five CBC differentials.

This is urgent for two reasons beyond the immediate data loss. Whether a row
resolves currently depends on how the extraction model phrased the label on that
run, so the same document can resolve differently across reprocessing. And the
`unmapped` bucket is now a mixture of "matching defect" and "analyte genuinely
absent", which makes it useless as the input signal for any future
catalog-growth work — a triage pass today would propose adding
`Alanine aminotransferase (ALT)` as a new analyte, duplicating reviewed ALT.

## What Changes

- Add an order-insensitive `token_set` alias match mode. It compares the sorted
  distinct token set derived from an alias's existing `normalizedValue` against
  the same projection of the raw label.
- Derive token sets from the **existing** alias corpus at module initialisation.
  No alias rows are authored, no field is added to `AliasDefinition`, and the
  catalog manifest digest is unchanged.
- Restrict the new mode to aliases whose authored `matchType` is `exact` or
  `normalized`, and to token sets of two or more tokens. Relaxed modes
  (`ocr_variant`, `bounded_fuzzy`) are not further relaxed.
- Score `token_set` below every ordered mode so a permuted label needs
  additional axis evidence before it can resolve concretely.
- Preserve the matched alias's own `matchAuthority`, `approvalStatus`,
  `lifecycle` and `provenance`; report `matchType: "token_set"` in evidence so
  the decision trace stays honest about which mode fired.
- Add a build-time collision invariant: no two reviewed measurement definitions
  may share a token-set key. Violation fails `verify:registry`.
- Add reason code `alias_token_set_match` to the EH-115 decision-trace
  allowlist, in TypeScript and in a new SQL migration.
- **BREAKING for release governance**: bump `MEASUREMENT_RESOLVER_VERSION` from
  `8` to `9`. `candidateInputHash` is computed over `resolverVersion`
  (`scripts/lib/registry-v2-candidate-corpus.ts:689`), so all seven approvals in
  `registry/candidate-release/v1/approvals.json` are invalidated and must be
  re-signed against the new hash before the candidate release is launchable.
- Add a regression suite asserting both orderings of every affected label
  produce identical outcomes, wired as `pnpm test:alias-order`.

Explicitly not changed: the admissibility bar, the compatibility axes, the
acceptance/correction writer, verification transitions, and the contents of the
measurement catalog.

## Capabilities

### New Capabilities

None. This change corrects the behaviour of an existing capability rather than
introducing one.

### Modified Capabilities

- `measurement-alias-authority`: alias admission gains an order-insensitive
  mode, with its authority, approval status and collision invariants specified.
- `context-aware-measurement-resolution`: candidate admission is no longer
  sensitive to label token order; the scoring relationship between match modes
  is specified.
- `resolver-decision-trace`: the persisted trace accepts and must record
  `alias_token_set_match`.
- `registry-release-corpus-governance`: a resolver-version bump invalidates
  pinned approvals, and the re-approval obligation is made explicit.

## Impact

- Affected domains: health-profile (measurement registry), documents (extraction
  review consumes the outcome).
- Affected code: `src/lib/biomarkers/types.ts` (`AliasMatchType`,
  `ResolutionReasonCode`), `src/lib/biomarkers/measurement-resolution.ts`
  (`aliasMatches`, `findAliasAdmissions`, `candidateEvidence`,
  `TRACE_REASON_CODES`, `MEASUREMENT_RESOLVER_VERSION`),
  `src/lib/biomarkers/normalize.ts` (token-set projection),
  `scripts/verify-alias-order-insensitivity.ts` (new), `package.json`.
- Affected data and operations: a new migration widening
  `eh115_validate_resolver_decision_trace`'s evidence-code allowlist; no table,
  column or RPC signature change; no backfill. Existing persisted traces stay
  valid because the allowlist only grows.
- Affected governance: `registry/candidate-release/v1/approvals.json` requires
  seven re-approvals; a new `registry-v2.0.0-candidate.2` tag is expected.
- Affected operations: an EH-116 reprocess dry-run must be reviewed before any
  `--apply`, because previously `unmapped` rows will change outcome.
