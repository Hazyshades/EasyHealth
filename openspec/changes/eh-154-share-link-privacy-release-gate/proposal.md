# Proposal: eh-154-share-link-privacy-release-gate

Domain: **reports / auth-shell**

## Why

Share links create an unauthenticated trust boundary around sensitive health information. Feature acceptance alone does not prove resistance to enumeration, replay, cache leakage, scope expansion, stale revocation, or privacy-invasive logging; release needs an explicit threat model and evidence gate.

## What Changes

- Record the share-link threat model: assets, actors, trust boundaries, abuse cases, controls, residual risk, and evidence owners.
- Define mandatory controls for token entropy and storage, expiry/revocation, PIN attempts, enumeration resistance, cache/index isolation, scope enforcement, rate limits, and metadata minimization.
- Add a release checklist that blocks deployment on any unresolved high or critical finding.
- Require focused verification for cross-profile access, expired/revoked links, source/document scope, export/download policy, generic errors, and no-store headers.
- Define privacy sign-off evidence and an incident runbook for token leakage, unauthorized access, and emergency revocation.
- Keep remediation in the owning feature change; EH-154 is the final gate and does not silently waive failed controls.

## Capabilities

### New Capabilities

- `share-link-privacy-gate`: Threat-model-driven security and privacy release gate for public share links.

### Modified Capabilities

_None._

## Impact

This change produces the release evidence and verification harness for EH-151, EH-152, and EH-153. It does not add a second share implementation or a parallel authorization path. Any high or critical finding blocks the milestone until the owning change supplies evidence and the gate is rerun.
