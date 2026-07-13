## Context

The legacy registry is split across two executable sources:

- `BIOMARKER_DEFINITIONS` contains 113 canonical biomarker records and their metadata;
- `normalize.ts` builds the effective alias map and defines canonical-key precedence, blocked missing-value tokens, short chemistry aliases, name fallback, and unknown-token behavior.

Registry 2.0 currently adds 14 concrete measurement definitions in parallel. It is not a one-for-one migration of all 113 legacy records: one analyte may produce multiple measurement definitions, while an unambiguous legacy definition may continue to use its compatibility mapping. EH-101 therefore freezes the v1 source catalog and its observable resolver behavior rather than treating the Registry 2.0 definition count as migration coverage.

The current audit baseline has 113 definitions, 383 effective alias-map entries, and six normalized source-alias collisions involving absolute versus percentage leukocyte variants. These are observations to reproduce and classify, not values to hardcode as permanent business rules.

## Goals / Non-Goals

**Goals:**

- Produce a deterministic `v1.0.0` baseline that accounts for every current legacy canonical key and all metadata used by downstream consumers.
- Serialize the effective alias map correctly instead of applying `JSON.stringify` directly to a JavaScript `Map`.
- Freeze observable legacy resolution behavior through named regression cases, including behavior that is surprising or later expected to change.
- Record audit findings with enough structure to drive later Registry 2.0 issues without silently correcting v1.
- Detect unreviewed drift in catalog content or resolver behavior through a repeatable check in CI.
- Bind the completed baseline release to an annotated Git tag after its artifacts are committed.

**Non-Goals:**

- Fix alias collisions, contextual short-alias behavior, specimen metadata, or conversion policies.
- Create one Registry 2.0 measurement definition for every v1 biomarker.
- Change `resolveCanonicalKey`, observation storage, score policy, assessment output, or historical data.
- Add Panel Registry, LOINC, Knowledge Base, SQL registry storage, external ranges, or medical recommendations.
- Claim that every unspecified specimen or absent conversion is a defect; the audit classifies each case for follow-up.

## Decisions

### 1. Store four complementary baseline artifacts

The baseline lives under `docs/biomarker-registry/v1.0.0/`:

```text
registry.json
resolver-cases.json
manifest.json
AUDIT.md
```

`registry.json` contains the complete canonical definition records. `resolver-cases.json` contains named inputs and observed outputs from the legacy resolver. `manifest.json` contains schema/version identifiers, deterministic content digests, source-file inventory, counts, and audit summary counts. `AUDIT.md` explains the findings and migration risks in human-reviewable form.

Alternative rejected: one JSON dump containing only `BIOMARKER_DEFINITIONS`. It would omit effective alias precedence and resolver behavior and would serialize `Map` incorrectly unless converted explicitly.

### 2. Canonicalize output before hashing

Generation sorts definitions by canonical key, object keys lexicographically, set-like arrays where order has no semantics, and effective alias-map entries by normalized alias. The digest is SHA-256 over canonical artifact content excluding the digest field itself. Volatile timestamps and the future baseline commit hash are excluded from hashed content; the annotated Git tag supplies repository traceability.

Source declaration order is not treated as semantically meaningful in `registry.json`, but resolver fixtures preserve outcomes affected by the current first-registration/canonical-key precedence rules.

Alternative rejected: pretty-print the runtime arrays in declaration order and hash the bytes. Harmless source reordering would create noisy releases while behavior changes could remain unexplained.

### 3. Freeze behavior with explicit resolver fixtures

The baseline generator converts `ALIAS_MAP` with a deterministic `Object.fromEntries` or sorted-entry representation and executes table-driven cases against `resolveCanonicalKey`. Fixtures cover:

- known canonical keys and EN/RU aliases;
- each normalized multi-owner source alias and its effective v1 winner;
- `Na`, `N/A`, `n.a.`, blocked missing tokens, and short chemistry symbols;
- key-versus-name fallback and canonical-key precedence;
- unknown labels and empty input;
- v1 distinctions that Registry 2.0 decomposes, including differential count/percent, RDW variants, reticulocytes, glucose specimen variants, and fasting context.

The fixtures record what v1 does, including unsafe or context-insensitive outcomes. They are compatibility evidence, not approval of those outcomes.

Alternative rejected: snapshot only `ALIAS_MAP`. The map does not capture missing-token handling, fallback order, or behavior outside direct hits.

### 4. Separate generated facts from reviewed audit judgments

Counts, inventories, alias-owner sets, effective winners, specimen presence, conversion types, equivalence groups, and derived markers are generated. `AUDIT.md` adds reviewed classifications:

- `documented-safe`;
- `ambiguous-context-required`;
- `breaking-change-risk`;
- `metadata-gap`;
- `follow-up-required`.

The audit explicitly distinguishes an absent specimen policy from a confirmed error and an explicit `conversion.type = "none"` from an accidentally missing conversion. Free T4 and total T4 are documented as distinct measurements, not placed in an equivalence group. Existing BUN/urea membership is recorded without changing it.

Alternative rejected: automatically label every unspecified specimen or missing conversion as defective. That would turn an inventory tool into an unsupported clinical model change.

### 5. Add check mode without changing runtime imports or behavior

A repository script supports explicit generation and read-only verification modes. Verification recreates artifacts in memory, compares canonical content and digests, checks that every current key appears exactly once, and fails on undocumented resolver or audit-summary drift. The existing registry CI workflow invokes check mode alongside current biomarker and measurement-registry verification.

The script may import current registry modules but SHALL NOT modify their exported behavior. No generated artifact is loaded by the application at runtime.

Alternative rejected: maintain the snapshot manually. Manual copies are prone to omissions and cannot prove that all 113 current keys remain accounted for.

### 6. Treat the Git tag as a release operation

The annotated tag is `registry-v1.0.0` and points to the clean commit containing the generated snapshot, resolver fixtures, manifest, audit report, and verification tooling. Tag annotation states that it freezes the legacy compatibility registry and does not indicate completion of Registry 2.0.

The implementation prepares and verifies the artifacts first. The tag is created only after the baseline commit exists and the worktree is clean; pushing the tag remains an explicit repository release action.

Alternative rejected: tag the pre-audit historical commit. That commit cannot contain the report and machine-readable baseline required by EH-101.

## Risks / Trade-offs

- [The retrospective baseline is mistaken for a pre-Registry-2 implementation state] -> State in the manifest, audit, and tag annotation that v1 remains the compatibility baseline while Registry 2.0 exists in parallel.
- [Generated and manually reviewed content drift apart] -> Generate all factual tables and summary counts, then require audit references to stable finding IDs checked by verification.
- [A known unsafe v1 behavior appears endorsed] -> Label fixtures as observed compatibility behavior and assign explicit follow-up classification in the audit.
- [A content digest changes because of ordering or formatting] -> Hash canonical semantic content and test generation determinism.
- [The tag is created on the wrong commit or a dirty worktree] -> Make clean-worktree and artifact-verification checks prerequisites to the annotated tag step.
- [EH-101 expands into Registry 2.0 migration work] -> Keep fixes and new definitions out of scope and link findings to later roadmap items.

## Migration Plan

1. Add deterministic baseline serialization and read-only verification tooling.
2. Generate `registry.json`, `resolver-cases.json`, and `manifest.json` from current v1 sources.
3. Review generated collision, specimen, conversion, equivalence, and breaking-risk inventories and write `AUDIT.md` with stable finding identifiers.
4. Run baseline verification twice to prove deterministic output, then run existing biomarker and Registry 2.0 checks.
5. Add baseline verification to CI without changing application runtime behavior.
6. Commit the complete EH-101 baseline on a clean branch.
7. Create the annotated `registry-v1.0.0` tag on that exact commit and push it only as an explicit release action.

Rollback consists of removing the documentation/tooling commit before tagging. After publication, the v1.0.0 artifacts and tag remain immutable; corrections require a new baseline version or an audit erratum rather than retagging.

## Open Questions

- Whether the annotated tag will be pushed directly by the maintainer or by the repository release workflow after merge.
- Which later roadmap issue owns each `follow-up-required` finding; EH-101 records links when known but does not block baseline publication on fixing them.
