# Registry v1.0.0 Audit

## Scope

This is a retrospective compatibility baseline for the static Registry v1 catalog. Registry 2.0 exists in parallel; this report neither asserts Registry 2.0 migration coverage nor changes runtime resolution, observations, scores, or medical policy.

## Method

The baseline generator reads the current `BIOMARKER_DEFINITIONS`, serializes the effective `ALIAS_MAP` as sorted entries, derives normalized alias ownership, and executes named `resolveCanonicalKey` fixtures. All factual counts below are generated from those sources.

## Catalog Summary

- Canonical definitions: 113
- Source aliases including canonical keys: 378
- Effective alias-map entries: 383
- Normalized multi-owner aliases: 6
- Derived markers: `non_hdl_cholesterol`, `remnant_cholesterol`

| System | Definitions |
| --- | ---: |
| blood | 25 |
| cardiovascular | 9 |
| general | 26 |
| inflammation | 3 |
| kidney | 24 |
| liver | 10 |
| metabolic | 5 |
| nutrients | 3 |
| thyroid | 8 |

## Alias Collisions

The following source aliases normalize to more than one v1 definition. The effective result is observed legacy behavior, not a context-aware approval.

| Normalized alias | Source owners | Effective v1 result | Finding |
| --- | --- | --- | --- |
| `базофилы` | `basophils`, `basophils_percent` | `basophils` | ALIAS-001 |
| `лимфоциты` | `lymphocytes`, `lymphocytes_percent` | `lymphocytes` | ALIAS-001 |
| `моноциты` | `monocytes`, `monocytes_percent` | `monocytes` | ALIAS-001 |
| `нейтрофилы` | `neutrophils`, `neutrophils_percent` | `neutrophils` | ALIAS-001 |
| `эозинофилы` | `eosinophils`, `eosinophils_percent` | `eosinophils` | ALIAS-001 |
| `neutrophils` | `neutrophils`, `neutrophils_percent` | `neutrophils` | ALIAS-001 |

## Resolver Behavior

Resolver fixtures freeze canonical-key precedence, direct alias lookup, short chemistry aliases, blocked/missing-token handling, key/name fallback, and unknown-token fallback. In particular, `Na`, `N/A`, and `n.a.` are separate fixtures. The source comment describes short aliases as contextual, but the effective v1 map contains direct short-alias entries; EH-101 records this behavior and does not alter it.

## Specimen Inventory

Unspecified means the v1 definition does not declare a specimen. It does not itself prove that the measurement is clinically invalid or that `any` is safe.

| Specimen policy | Definitions |
| --- | ---: |
| serum | 1 |
| unspecified | 100 |
| urine | 12 |

## Conversion Inventory

Explicit `none` means conversion was consciously not defined. Missing means the definition has no conversion field and remains a metadata-review item. EH-101 adds neither medical conversions nor external reference ranges.

| Conversion policy | Definitions |
| --- | ---: |
| equal | 15 |
| formula | 3 |
| linear | 39 |
| missing | 36 |
| none | 20 |

## Equivalence and Derived Markers

The current equivalence inventory is preserved without semantic expansion. `bun` and `urea` share `urea_nitrogen`. Free T4 and total T4 are distinct measurements, not equivalence members.

| Equivalence group | Members |
| --- | --- |
| `urea_nitrogen` | `bun`, `urea` |

## Registry 2.0 Migration Risks

The following distinctions require explicit compatibility review in later changes: differential absolute versus percentage values, RDW-CV versus RDW-SD, reticulocytes without a v1 canonical key, serum/plasma versus whole-blood versus urine glucose, fasting glucose context, and free versus total thyroid forms. A shared analyte family is not an equivalence rule.

## Reviewed Findings

| ID | Classification | Title | Summary |
| --- | --- | --- | --- |
| ALIAS-001 | ambiguous-context-required | Normalized source alias collisions | 6 normalized aliases have more than one v1 owner; their current effective winners are frozen as compatibility behavior. Follow-up: EH-102 and EH-110. |
| RESOLVER-001 | follow-up-required | Short aliases and missing-value tokens | Short chemistry aliases, blocked missing tokens, first-registration behavior, canonical-key precedence, and key/name fallback are recorded by resolver fixtures for later context-aware review. Follow-up: EH-102 and EH-110. |
| SPECIMEN-001 | metadata-gap | Unspecified specimen metadata | 100 v1 definitions have no explicit specimen policy. This is an inventory fact, not a clinical error classification. Follow-up: EH-102. |
| CONVERSION-001 | documented-safe | Explicit no-conversion policies | 20 definitions explicitly declare no conversion, including assay-specific, activity, ratio, or already-native unit handling. |
| CONVERSION-002 | follow-up-required | Definitions without a conversion policy | 36 definitions omit conversion metadata and require later classification without adding conversion behavior in EH-101. Follow-up: EH-102. |
| EQUIVALENCE-001 | documented-safe | Current equivalence groups | The snapshot preserves BUN and urea in the existing urea_nitrogen group; free/total thyroid measurements and other related analytes are not collapsed into this group. |
| IDENTITY-001 | breaking-change-risk | Measurement-definition migration boundaries | Differential count versus percent, RDW-CV/RDW-SD, reticulocytes, specimen-specific glucose, fasting context, and free/total thyroid forms require explicit compatibility review before mapping changes are promoted. Follow-up: EH-102 and EH-107. |

## Release Boundary

Run `npm run check:registry-v1`, `npm run test:registry-v1`, `npm run verify:registry`, and `npm run typecheck` before committing this baseline. After a clean commit contains the generated artifacts and tooling, create the annotated tag:

`git tag -a registry-v1.0.0 -m "Registry v1.0.0 legacy compatibility baseline"`

Do not rewrite a published tag. Publish an audit erratum or a new baseline version for later corrections.
