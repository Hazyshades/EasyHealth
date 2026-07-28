## ADDED Requirements

### Requirement: Processing claim SQL SHALL be unambiguous
The service-only `claim_document_processing_job(uuid)` RPC SHALL qualify every processing-attempt column reference that can conflict with a PL/pgSQL parameter, local variable, or `RETURNS TABLE` output name. Calling the RPC on a valid queued job MUST NOT raise an ambiguous-column error.

#### Scenario: Valid queued job is claimed
- **WHEN** the service role calls the RPC for a valid queued job with no active attempt
- **THEN** the RPC SHALL atomically transition the job, create one active attempt, and return the claim without an ambiguous-column exception

#### Scenario: Existing active attempt prevents a second claim
- **WHEN** the service role calls the RPC for a document that already has an active attempt
- **THEN** the RPC SHALL return no claim without surfacing a constraint or ambiguity error

### Requirement: Repair migration SHALL preserve the claim contract
The ambiguity repair SHALL be delivered as an additive migration after the deployed processing-attempt migration. It SHALL replace only the function definition and preserve its signature, security-definer boundary, fixed search path, document-to-job-to-attempt lock order, ownership checks, attempt numbering, and returned fields.

#### Scenario: Existing deployment receives the repair
- **WHEN** the repair migration runs after the original processing-attempt migration
- **THEN** the corrected function SHALL replace the prior definition without rewriting processing data or changing caller contracts
