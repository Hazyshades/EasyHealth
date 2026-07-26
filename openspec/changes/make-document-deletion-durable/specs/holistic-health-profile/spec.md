## MODIFIED Requirements

### Requirement: Holistic synthesis reflects active sources only

Persisted holistic synthesis MUST be invalidated in the same transaction that tombstones any source document for the profile. Regeneration and serving MUST use only active non-deleting source documents and current publication content.

#### Scenario: Synthesis contains a deleting document

- **WHEN** owner deletion tombstones a document in the profile
- **THEN** the cached synthesis becomes inaccessible or is deleted before the tombstone transaction commits
- **AND** no stale `synthesis_text` or summary derived from that document is served during cleanup

#### Scenario: Synthesis regenerates after deletion

- **WHEN** synthesis is generated after tombstone commit
- **THEN** source loading excludes the deleting document and its observations/findings
- **AND** the replacement synthesis contains only active-source context

#### Scenario: Final purge completes

- **WHEN** the document and its derivatives are hard-purged
- **THEN** synthesis remains invalid until a successful active-source regeneration commits


### Requirement: Holistic synthesis persistence is atomic and deletion-race safe

`profile_health_synthesis` MUST be upserted only through a service-only fixed-search-path database writer that locks the synthesis row and every exact source document in sorted UUID order, revalidates active/not-deleting state and captured write generations at commit, and rejects persistence after tombstone or generation drift. Direct table DML MUST be revoked from runtime roles.

#### Scenario: Tombstone occurs between synthesis generation and upsert

- **WHEN** synthesis text was generated from sources and one source is tombstoned before upsert
- **THEN** the synthesis writer rejects the upsert
- **AND** no cache row retaining that source's PHI remains

#### Scenario: Direct synthesis upsert is attempted

- **WHEN** service role issues a direct upsert into `profile_health_synthesis`
- **THEN** permission is denied
