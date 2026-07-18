## MODIFIED Requirements

### Requirement: Session-authorized asynchronous upload
A valid Supabase Auth session SHALL authorize document upload. The upload endpoint SHALL validate accepted file types and size, save the file, create the document and processing job, and return processing status without payment negotiation.

#### Scenario: Authenticated valid upload
- **WHEN** a signed-in user uploads a valid PDF, JPEG, or PNG within the size limit
- **THEN** the document and processing job are created
- **AND** no payment header, wallet state, or payment settlement is required

#### Scenario: Unauthenticated upload
- **WHEN** a request lacks a valid Supabase Auth session
- **THEN** the endpoint returns HTTP 401 before storage work