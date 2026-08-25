## Why

The Health Profile currently treats the newest accepted observation as current based on `observed_at`, but it has no explicit freshness policy, no safe representation for a missing medical date, and no durable record of which freshness rules produced an assessment. After EH-126 made source dates nullable and EH-143 made readiness strict, an old result can be confused with missing evidence and a later policy change cannot be audited.

## What Changes

- Add a versioned Health Profile freshness policy for the eight named body systems. The policy is explicit technical product configuration, not a diagnosis, risk estimate, or recommendation to obtain a test.
- Treat the source medical date (`observed_at`, the `measuredAt` contract) as the only freshness input. Preserve `null` as an unknown date; never substitute upload, processing, or assessment-generation time.
- Classify assessment inputs as current, outdated, or unknown-date using deterministic policy evaluation at assessment-generation time. Outdated and unknown-date observations remain visible as factual source data but cannot satisfy a score-readiness group.
- Extend machine-readable readiness and marker data so outdated evidence is distinguishable from missing evidence and from present evidence without a usable reference range.
- Update Health Profile API and first-party UI wording to show factual outdated/date-unknown states without telling users to order tests or implying diagnosis. Existing document-upload navigation remains an evidence-management action only.
- Record the freshness policy version with every persisted Health Profile assessment version and expose it in the assessment metadata returned by the API.
- Add focused pure, API/worker, database migration/RPC, and UI-contract regression coverage plus the required `QA/eh-144/checklist.md` evidence record.

## Capabilities

### New Capabilities

- `health-profile-freshness-policy`: Versioned source-date freshness evaluation, readiness exclusion reasons, assessment-version stamping, and factual Health Profile presentation.

### Modified Capabilities

- None.

## Impact

- **Target domain:** `health-profile`; the change also crosses the assessment recalculation worker and the EH-123 assessment-version persistence RPC.
- **Runtime:** `src/lib/health-systems.ts`, Health Profile input/snapshot projection, the Health Profile API, worker completion payloads, and Health Profile body-map/drawer copy.
- **Database:** additive freshness-policy-version storage on immutable assessment versions and the completion RPC contract; no patient observation dates are rewritten or fabricated.
- **Dependencies:** EH-126 normalized medical-event date semantics and EH-143 strict readiness/null-score behavior.
- **Documentation and QA:** document the technical policy boundary, run the applicable Registry/Health Profile documentation drift checks because Health Profile laboratory projection changes, and record manual UI limitations without claiming unavailable fixtures were tested.
