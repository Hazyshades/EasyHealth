## ADDED Requirements

### Requirement: Root metadata has a production URL base
The root Next.js metadata SHALL set `metadataBase` to the absolute `NEXT_PUBLIC_SITE_URL` when provided or `https://easyhealth.app` otherwise.

#### Scenario: Deployment emits relative social metadata
- **WHEN** Next.js resolves a relative metadata URL
- **THEN** it SHALL use the configured production origin
- **AND** it SHALL not use localhost by default.