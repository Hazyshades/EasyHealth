## ADDED Requirements

### Requirement: Processing claim SQL SHALL be unambiguous
The service-only `claim_document_processing_job(uuid)` RPC SHALL qualify every processing-attempt column reference that can conflict with a PL/pgSQL parameter, local variable, or `RETURNS TABLE` output name. Calling the RPC on a valid queued job MUST NOT raise an ambiguous-column error.

#### Scenario: Valid queued job is claimed
- **WHEN** the service role calls the RPC for a valid queued job with no active attempt
- **THEN** the RPC SHALL atomically transition the job, create one active attempt, and return the claim without an ambiguous-column exception

#### Scenario: Existing active attempt prevents a second claim
- **WHEN** the service role calls the RPC for a document that already has an active attempt
- **THEN** the RPC SHALL return no claim without surfacing a constraint or ambiguity error

### Requirement: Publication preparation SQL SHALL be unambiguous
The service-only `prepare_instrumental_publication(uuid, uuid, uuid, jsonb, text)` RPC SHALL qualify snapshot-content and publication columns that conflict with its `RETURNS TABLE` output names. Preparing a valid instrumental snapshot MUST NOT raise an ambiguous-column error.

#### Scenario: Valid instrumental publication is prepared
- **WHEN** the service role prepares a valid snapshot for an active owned processing attempt
- **THEN** the RPC SHALL create or reuse its content and prepared publication without an ambiguous-column exception

### Requirement: Publication finalization SQL SHALL be unambiguous
The service-only `finalize_instrumental_publication(uuid, uuid, uuid, uuid, uuid, text, text, text, jsonb)` RPC SHALL qualify document columns that conflict with its `RETURNS TABLE` output names. Finalizing a valid prepared publication MUST NOT raise an ambiguous-column error.

#### Scenario: Valid instrumental publication is finalized
- **WHEN** the service role finalizes a valid prepared publication for its active owned processing attempt
- **THEN** the RPC SHALL atomically publish it and advance document `write_generation` exactly once without an ambiguous-column exception

### Requirement: Repair migration SHALL preserve all repaired RPC contracts
The ambiguity repair SHALL be delivered as one additive migration after the deployed processing-attempt and instrumental-publication migrations. It SHALL replace only the three affected function definitions and preserve their signatures, security-definer boundaries, fixed search paths, lock order, ownership checks, state transitions, attempt/content identity, and returned fields.

#### Scenario: Existing deployment receives the repair
- **WHEN** the repair migration runs after the original processing-attempt and instrumental-publication migrations
- **THEN** the corrected functions SHALL replace the prior definitions without rewriting processing data or changing caller contracts
