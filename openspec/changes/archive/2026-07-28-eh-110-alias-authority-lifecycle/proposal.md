## Why

Registry 2.0 carries alias metadata, but its construction treats every alias as normalized and reviewed while the resolver ignores match type, approval state, source, and provenance. EH-109 needs an authoritative alias contract before it can make safe evidence decisions, so alias lifecycle and ownership must be frozen first.

## What Changes

- Introduce an authoritative `AliasDefinition` contract for Registry 2.0 aliases, including stable identity, literal and normalized forms, source/laboratory/locale attribution, fixture references, match authority, review ownership, and lifecycle state.
- Define explicit approval and lifecycle transitions for aliases: provisional evidence may support recognition only; reviewed active aliases may support concrete resolution; deprecated aliases remain reproducible in historical manifests but cannot create new resolver matches.
- Add the bounded-fuzzy alias match class with an explicit normalization-distance bound and a mandatory reviewed authority record; prohibit unbounded substring, token-containment, or edit-distance matching.
- Replace the current implicit alias factory so Registry definitions and corpus fixtures declare their real provenance, authority, and lifecycle instead of being generated as reviewed normalized aliases.
- Require the resolver boundary to select candidates only through active aliases whose authority permits the requested outcome, preserving the matched alias identity in candidate evidence for EH-109.
- Include all authority-bearing alias fields in deterministic registry-manifest serialization and classify authority, provenance, lifecycle, or matching-policy changes as review-required or breaking as appropriate.
- Establish ownership for the de-identified launch corpus and its alias fixtures, including exact fixture identifiers, source/laboratory attribution rules, review records, and negative authority cases proving that inactive, provisional, foreign-laboratory, and unsupported fuzzy aliases cannot resolve a reviewed definition.
- Define the pre-launch migration/cutover policy for existing in-code aliases: no legacy fallback or compatibility alias path remains after the contract is adopted.

## Capabilities

### New Capabilities
- `measurement-alias-authority`: Defines the Registry 2.0 alias identity, provenance, authority, lifecycle, match-policy, corpus ownership, manifest, and resolver-admission contract.

### Modified Capabilities
- None. The repository has no main capability specs; this change establishes the first alias-authority capability specification.

## Impact

- **Domain:** documents — laboratory extraction normalization and Registry 2.0 release governance.
- **Code:** `src/lib/biomarkers/types.ts`, `measurement-resolution.ts`, `measurement-registry-release.ts`, launch-fixture/corpus definitions, resolver evidence DTOs, and focused Registry 2.0 tests.
- **Data and release artifacts:** explicit alias records, deterministic registry manifests, de-identified corpus fixture metadata, and versioned review evidence.
- **Dependencies:** EH-102/EH-104/EH-105/EH-107 are complete. EH-109 consumes this contract and must not duplicate its matching policy.
- **Breaking:** existing implicit `MeasurementAlias` construction and any resolver assumption that normalized strings are sufficient authority are removed in the pre-launch cutover.