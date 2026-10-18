## Why

The current laboratory Document review workspace exposes manual value correction and Registry mapping alongside ordinary extraction acceptance. That is appropriate for experienced users, but it makes the safe path unnecessarily technical and allows a non-technical user to replace an extracted result without a clear mode boundary. EasyHealth needs an explicit Easy path that preserves the LLM/OCR extraction as reported while retaining the current Pro workflow for users who need manual control.

## What Changes

- Add a profile setting for the default laboratory Document review mode: `easy` or `pro`.
- Add a Document-scoped effective review mode for `lab_result` Documents. Users may switch the mode before the first acceptance; the mode is then fixed for that Document's initial review.
- Add Easy review behavior that presents read-only extracted evidence and supports explicit acceptance or rejection without manual value correction, manual Registry mapping, or batch verification.
- Keep the existing Pro review workspace, correction form, manual mapping, technical details, verification, and append-only correction history.
- Enforce the Easy action boundary on authenticated server APIs, not only by hiding controls in the client.
- Allow an explicitly initiated Pro correction after an Easy acceptance, preserving the original acceptance and appending a new normalization revision.
- Preserve raw evidence, source provenance, extraction confidence, and the existing deterministic Resolver behavior. This change does not alter extraction prompts or make an LLM-proposed identity authoritative.
- Keep the existing explicit acceptance requirement. Easy does not silently auto-save extracted biomarkers after processing.

## Capabilities

### New Capabilities

- `document-review-modes`: Profile defaults, Document-scoped mode selection and locking, Easy and Pro action policy, and explicit Pro escalation for later correction.

### Modified Capabilities

None. Existing laboratory outcome, Resolver, decision-trace, and Health Profile reported-result requirements remain authoritative; the new capability constrains which review actions are available in each mode without changing their underlying data contracts.

## Impact

Target domains: `auth-shell` and `documents`.

- Profile persistence, `/api/profile`, and Settings UI gain the review-mode default.
- Document persistence and the owner-scoped Document review bootstrap expose the effective mode and its lock state.
- Laboratory acceptance, rejection, correction, manual mapping, batch verification, and reprocess paths enforce the mode policy server-side.
- `DocumentViewer` and review components render a read-only Easy surface and retain the current Pro surface.
- Existing contracts that must remain intact include `incomplete-laboratory-outcomes`, `context-aware-measurement-resolution`, `resolver-decision-trace`, `health-profile-reported-results`, and `censored-lab-results`.
- Implementation will require the repository's roadmap QA checklist and Registry documentation synchronization gates because it changes biomarker persistence and review behavior.
