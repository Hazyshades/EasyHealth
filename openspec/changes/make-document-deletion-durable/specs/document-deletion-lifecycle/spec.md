## ADDED Requirements

### Requirement: Deletion begins with an atomic tombstone and authoritative operation

An owner deletion request MUST atomically mark the document `deleting`, increment its existing write generation, prevent new access/mutations, request cancellation of active work, invalidate persisted derivatives, and insert one authoritative deletion operation before returning `202 Accepted`.

#### Scenario: Owner requests deletion

- **WHEN** the authenticated owner deletes an active document
- **THEN** the API returns `202 Accepted` with one deletion operation id after the tombstone transaction commits
- **AND** the response does not claim final storage or database purge

#### Scenario: Owner repeats deletion

- **WHEN** the same owner repeats DELETE for a deleting or already purged document with a retained operation
- **THEN** the API returns the existing operation/status
- **AND** no duplicate cleanup operation is created

### Requirement: One operation table is the transactional outbox and queue

`document_deletion_operations` SHALL be the sole authoritative cleanup queue, claim lease, retry state, error state, owner-visible status, and retained completion receipt. The operation SHALL survive document hard purge without a cascading FK and SHALL retain only non-PHI identifiers, timestamps, state, and evidence digests for the configured retention period.

#### Scenario: Cleanup worker claims an operation

- **WHEN** a cleanup worker polls eligible operations
- **THEN** it transactionally claims one operation with a bounded lease using skip-locked semantics
- **AND** no second queue/outbox can report a divergent state

#### Scenario: Document hard purge completes

- **WHEN** the document row and derived PHI are deleted
- **THEN** the operation row remains owner-queryable as completed until receipt retention expires
- **AND** it contains no filename, raw storage path, extracted text, clinical value, or generated narrative

### Requirement: Previously issued signed URLs have bounded residual validity

After tombstone the system MUST issue no new signed URLs. A URL issued earlier MAY remain usable until its object is removed or its existing 900-second TTL expires; deletion status MUST remain non-final while required storage objects still exist.

#### Scenario: Cached URL exists at deletion time

- **WHEN** the owner previously received a signed URL and deletion is accepted
- **THEN** API reads no longer return new URLs
- **AND** cleanup removes the object as soon as writer fencing permits
- **AND** the product does not claim immediate revocation of the already issued token

### Requirement: Storage cleanup is complete, paginated, and verified

Cleanup MUST enumerate and remove all registered generation paths and generation-0 legacy paths, traverse every nested prefix and storage page, observe writer quiescence, and obtain at least two complete empty listings separated by the configured stability interval before database purge starts.

#### Scenario: Object appears after the first empty listing

- **WHEN** a late in-flight upload becomes visible during the stability interval
- **THEN** cleanup removes it and restarts purge/verification
- **AND** final database purge does not start

#### Scenario: Listing spans pages and nested prefixes

- **WHEN** a document owns more objects than one storage page or nested paths
- **THEN** cleanup follows every page/prefix and removes every object before stable-empty verification succeeds

### Requirement: Generation zero and future storage paths are both authoritative inventory

Existing documents SHALL use generation `0`, whose purge inventory includes document storage/original/normalized/thumbnail columns, page preview and OCR JSON columns, the recursive legacy `${profileId}/${documentId}` prefix, and any additional retained path discovered by preflight. Future uploads SHALL use server-generated generation-scoped paths registered by storage-write intents.

#### Scenario: Legacy document contains an unregistered nested object

- **WHEN** the object is under the legacy document prefix but absent from database path columns
- **THEN** complete recursive prefix listing finds and removes it

#### Scenario: Document was reprocessed across generations

- **WHEN** several generations produced registered paths
- **THEN** deletion inventories and purges every generation rather than only the latest

### Requirement: Final database purge follows verified storage absence

Only after stable-empty evidence and writer fencing pass MAY one database transaction delete observations and all document-derived rows, purge invalidated reports/derivatives, delete the document, and complete the retained independent operation receipt. Any failure MUST roll the database transaction back and leave the operation retryable.

#### Scenario: Database purge fails

- **WHEN** any final purge statement fails
- **THEN** the database transaction rolls back
- **AND** the document remains tombstoned and the operation remains retryable without false completion

#### Scenario: Storage verification is stale

- **WHEN** a required object or live writer exists after earlier evidence
- **THEN** final purge refuses to run and returns the operation to cleanup/verification

### Requirement: Cleanup and status access are owner-scoped

Deletion claim/finalize functions MUST be service-only with fixed search paths and internal ownership checks. Owners MAY query only their own operation; another profile receives 403 or 404 without document identity or PHI disclosure.

#### Scenario: Another profile requests operation status

- **WHEN** a caller from another profile requests the deletion operation
- **THEN** the API returns 403 or 404 without revealing document identity, storage paths, or cleanup details


### Requirement: Storage object creation uses a constrained upload capability

Document workers MUST NOT create Storage objects with an unrestricted service-role key. Object creation MUST use a one-time signed upload capability minted by a fixed-search-path database function only after a storage-write intent is registered for an active non-tombstoned attempt/generation and exact server-generated path. A stale, expired, cancelled, or prior-generation worker MUST be unable to upload an unregistered object.

#### Scenario: Stale worker attempts upload after tombstone

- **WHEN** a worker with an expired/cancelled attempt or prior write generation requests an upload capability or uploads to a path
- **THEN** capability minting is denied or the upload is not accepted for an unregistered path
- **AND** deletion cleanup does not observe a durable unregistered object for that document

#### Scenario: Valid worker uploads through minted capability

- **WHEN** an active lease-aware attempt registers an intent and receives a path-bound signed capability
- **THEN** it can upload only to that registered path before the capability TTL expires
- **AND** completion RPC marks the intent complete only after fence revalidation

### Requirement: ai_invocations retain only allowlisted non-PHI error codes

`ai_invocations.error_code` MUST contain only an allowlisted non-PHI code and MUST NEVER store raw exception messages, filenames, prompts, responses, or clinical text. Legacy profile-level report/synthesis invocations with `document_id IS NULL` MUST be conservatively purged or redacted for the profile at tombstone unless exact source linkage proves the deleted document was not used.

#### Scenario: LLM failure is logged

- **WHEN** a provider call fails with a raw exception message
- **THEN** the logger stores an allowlisted `error_code` only
- **AND** the raw message is not persisted in `ai_invocations`

#### Scenario: Profile-level synthesis invocation lacks document linkage

- **WHEN** a document is tombstoned and profile-level report/synthesis `ai_invocations` rows have `document_id IS NULL` without exact source ids
- **THEN** those rows are purged or redacted with the deletion operation
- **AND** they are not retained as proof-free audit metadata
