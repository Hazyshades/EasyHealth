# health-profile-api Specification

## ADDED Requirements

### Requirement: Assistant API returns evidence-bearing profile-scoped answers

The authenticated assistant endpoint SHALL derive profile identity from the Supabase session, enforce closed-beta and consent gates, apply server-owned retrieval filters, and return an answer object with mode, limitations, citations, and coverage metadata. It SHALL not return another profile's data or accept a client profile ID.

#### Scenario: Authenticated assistant request

- **WHEN** an invited user submits a valid assistant question
- **THEN** the API returns an answer tied to the session profile
- **AND** every personal claim has a validated citation or the response is limited

#### Scenario: Unauthenticated request

- **WHEN** no valid Supabase session exists
- **THEN** the API returns HTTP 401
- **AND** no retrieval, quota, or provider call occurs

#### Scenario: Scope tampering

- **WHEN** a client submits document IDs or filters containing another profile's document
- **THEN** the server intersects the request with the session profile
- **AND** the response reveals no cross-profile existence
