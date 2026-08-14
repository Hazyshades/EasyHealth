## Context

Registry 2.0 is a static TypeScript catalog of concrete measurement definitions. Each reviewed definition already carries a clinically safe identity and may have an independent reviewed assessment binding. The catalog has deterministic manifest serialization and a candidate-release approval process, but it has no panel entity. Reconstructing panels from score roles, body systems, labels, or Registry v1 would conflate unrelated concepts and is unsafe.

The current runtime catalog has reviewed definitions for CBC, lipid, thyroid, liver, and kidney panels. Registry v1 contains iron-study records, but Registry v1 is audit-only; reviewed Registry 2.0 concrete iron definitions must be established before an iron-studies panel can be published.

The separate `add-reviewed-panel-specimen-policy` change defines a future, tightly constrained path from OCR-verified section headings to a reviewed specimen policy. That policy is not panel membership and is not implemented here.

## Goals / Non-Goals

**Goals:**

- Publish a deterministic static registry for the six EH-125 panel families.
- Represent a panel member as a reference to one reviewed concrete Registry 2.0 measurement definition, with an explicit `required` or `optional` role and deterministic display order.
- Permit the same concrete definition to belong to multiple panels without copying or mutating the definition.
- Make panel data part of the frozen Registry 2.0 manifest and candidate-input hash.
- Add clinically reviewed Registry 2.0 iron-study definitions sufficient to support a non-empty iron-studies panel.
- Generate canonical documentation and regression fixtures from the runtime registry.

**Non-Goals:**

- Database tables, migrations, row persistence, APIs, document extraction, OCR-heading matching, resolver changes, specimen inference, reprocessing, score changes, readiness calculation, timeline UI, or knowledge-base pages.
- Treating a panel alias as extraction evidence or treating membership as an assessment binding.
- Using Registry v1 keys, aliases, scoring groups, or legacy runtime adapters as panel members.
- Inferring a full panel from observed laboratory rows or declaring a panel clinically complete.

## Decisions

### 1. Static Registry 2.0 catalog, not database state

Add `PanelKey`, `PanelMemberRole`, `PanelMember`, and `PanelDefinition` alongside existing Registry 2.0 types and publish immutable static data under `src/lib/biomarkers/`. A member references `MeasurementDefinitionKey`, never a display label or analyte key.

A panel is catalog knowledge, not patient-specific state. A database model would create migration, authorization, and history obligations before any consumer needs them; a static source follows the existing Registry 2.0 catalog and deterministic release process.

**Alternatives considered:**
- Database tables: rejected; no panel data is persisted or edited at runtime.
- Analyte-key membership: rejected; it loses specimen, method, timing, and value-kind distinctions already enforced by Registry 2.0.
- Deriving panels from body system or score role: rejected; panel membership and assessment are independent by product contract.

### 2. One non-redundant membership role

`PanelMember` uses `role: "required" | "optional"` plus a positive `displayOrder`. `required` identifies a core expected member of the panel; `optional` identifies a recognized extension. EH-125 does not calculate panel completeness from either role.

Do not store a second `required: boolean`; it creates contradictory states. The display order is catalog presentation metadata only and does not rank resolution candidates.

### 3. Separate panel aliases from document evidence

`PanelDefinition` contains a canonical display name and alternate names for catalog display and future explicit consumers. EH-125 does not export a document-heading classifier and does not normalize an extracted heading into a panel key.

The existing panel-specimen-policy change may later consume stable panel keys only after OCR provenance, policy review, analyte allowlisting, and resolver-trace safeguards are satisfied.

### 4. Panels are manifest-covered release input

Extend the existing canonical Registry 2.0 manifest serialization to include a stable, key-sorted panel projection. The panel projection includes each panel's key, display metadata, and ordered membership records. Changing panel data changes the manifest digest, candidate-input hash, and requires release approval renewal under the existing fail-closed gate.

This uses the current evidence path instead of maintaining an independent, ungoverned panel version. Panel data itself does not change resolver behavior, so the resolver version does not change solely for this feature.

### 5. Validation before export and fixtures after curation

Provide a pure registry validator and fixtures. Validation rejects duplicate panel keys, normalized alternate-name collisions, duplicate member keys within a panel, duplicate display orders within a panel, non-positive display orders, missing definitions, and members that are not reviewed Registry 2.0 definitions. It permits a definition in multiple panels.

Fixture coverage asserts each named panel has its reviewed curated membership, a shared concrete member is retrievable from each owning panel, ordering is deterministic, and panel data cannot change resolver or assessment results.

### 6. Iron studies require new reviewed concrete definitions

Use Registry v1 iron-study records only as migration evidence. Before publishing the iron-studies panel, define the concrete Registry 2.0 identity axes, unit policies, aliases, maturity, and non-score-affecting or reviewed assessment bindings for the clinically approved iron-study set. The panel may then reference only those resulting reviewed keys.

An empty panel or a member that points to a Registry v1 key would appear complete while being unusable by the only runtime registry; both are prohibited.

## Risks / Trade-offs

- **Clinical roster risk:** A familiar panel label does not determine a universally correct member list. Each required/optional roster, especially iron studies and cross-panel members, needs explicit clinical review before release.
- **Release evidence churn:** Any panel change invalidates the candidate-input hash. This is intentional and must not be bypassed by treating the change as display-only.
- **Future policy coupling:** Panel aliases look similar to section-heading aliases. Keeping them non-executable now prevents membership data from becoming an undocumented specimen-inference path.
- **No current UI:** The registry is a foundation. Manual QA cannot claim a panel screen is tested; the checklist must request deterministic test, generated-documentation, and approval evidence.

## Migration Plan

1. Add types, static catalog data, validation, release serialization, fixtures, exports, and generated documentation without changing stored data.
2. Establish reviewed Registry 2.0 iron-study definitions, then include their panel memberships in the same manifest-bound release.
3. Run catalog, fixture, documentation, type, and candidate-release checks; renew required approvals for the new candidate-input hash.
4. No database migration, backfill, observation rewrite, or rollback migration is required. Corrections are forward catalog releases with fresh evidence.

## Open Questions

- Clinical owner must approve the exact required and optional rosters, including any deliberately shared CBC/iron member.
- Existing candidate-release policy may need an explicit panel-membership review note, but no new automatic reviewer role is proposed unless governance requires it.