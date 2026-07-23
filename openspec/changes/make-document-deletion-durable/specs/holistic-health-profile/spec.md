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
