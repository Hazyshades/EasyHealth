## REMOVED Requirements

### Requirement: x402 unchanged

**Reason:** Human upload and report endpoints no longer require x402 payment; AI provider preference remains free and orthogonal.
**Migration:** Changing `ai_provider` does not interact with payment; document upload and reports are session-authenticated only.

## ADDED Requirements

### Requirement: AI preference independent of billing

Changing AI provider preference SHALL NOT introduce payment requirements for upload, reports, or synthesis. All such human features remain free for signed-in users.

#### Scenario: Upload free regardless of provider

- **WHEN** a user uploads a document for extraction regardless of AI provider
- **THEN** the request does not require x402 payment
- **AND** is authorized by session only
