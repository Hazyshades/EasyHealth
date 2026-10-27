# semantic-document-retrieval Specification

## ADDED Requirements

### Requirement: Narrative documents are chunked with source anchors

The semantic index SHALL chunk eligible document page text into bounded chunks while retaining profile ID, document ID, page number, chunk index, document type, source date, content hash, and a bounded section label where available. A chunk SHALL never combine text from different documents.

#### Scenario: Multi-page narrative document

- **WHEN** a processed consultation note has OCR text on multiple pages
- **THEN** the index stores page-anchored chunks with stable chunk identifiers
- **AND** each result can cite the source document and page

#### Scenario: Empty OCR page

- **WHEN** a page has no usable text after normalization
- **THEN** no empty chunk is stored for that page

### Requirement: Semantic search repeats authorization predicates in SQL

The semantic match function SHALL require a profile ID and SHALL filter by that profile, active document lifecycle, complete upload state, processed state, optional document IDs, optional document types, and optional inclusive dates inside the database function. The caller SHALL not be able to bypass those predicates through result metadata.

#### Scenario: Cross-profile query attempt

- **WHEN** a caller supplies another profile ID or a document ID owned by another profile
- **THEN** the match function returns no cross-profile rows
- **AND** the API does not reveal whether those rows exist

#### Scenario: Deleted source

- **WHEN** a document is archived or enters durable deletion
- **THEN** its chunks are unavailable to semantic retrieval
- **AND** queued re-index work cannot restore chunks for that document

### Requirement: Semantic results are explicitly labeled as document text

Semantic results SHALL be labeled `document_text`, include similarity metadata, source page and document links, and SHALL NOT be labeled as verified structured observations. The answer contract SHALL preserve that distinction in citations and limitations.

#### Scenario: Narrative passage answer

- **WHEN** a query matches an accepted narrative document passage
- **THEN** the response citation identifies the document and page
- **AND** the answer states when a claim is based on document text rather than a verified structured observation

### Requirement: Re-indexing is idempotent and observable

The system SHALL persist re-index jobs with profile/document ownership, requested content hash, attempts, status, and safe error codes. A successful job SHALL replace only the current document's chunks after verifying the document is still active and the source hash matches. Repeating a job for the same hash SHALL not create duplicate current chunks.

#### Scenario: Document re-index request

- **WHEN** an operator or document-processing path requests re-indexing
- **THEN** one queued job is created for the profile/document/hash
- **AND** a worker can claim, complete, retry, or fail the job without logging source text

#### Scenario: Source changed during indexing

- **WHEN** the document lifecycle or content hash changes before an index write
- **THEN** the job does not publish stale chunks
- **AND** the job records a safe stale-source outcome

### Requirement: Embedding availability fails safely

The semantic index SHALL require a configured embedding model and vector extension. When embeddings are unavailable, the assistant SHALL preserve structured retrieval and return an explicit semantic-retrieval limitation instead of inventing narrative evidence.

#### Scenario: Embedding provider unavailable

- **WHEN** the configured embedding provider times out or rejects the request
- **THEN** the semantic job records a non-PHI provider error
- **AND** the assistant response does not include semantic sources
