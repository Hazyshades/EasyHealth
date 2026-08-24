## Why

The Health Profile already returns nullable system scores and durable assessment-job status, but the body map, system controls, drawer, and overall card do not present those signals as one coherent state model. A user can see a muted score placeholder, an amber update message, or an old snapshot without being told whether the system is scored, evidence-insufficient, updating, outdated, or failed; the same surfaces also need a stronger non-diagnostic boundary on narrow screens and deep-linked selections.

EH-146 finalizes that presentation contract after the strict readiness and provenance work: evidence availability must remain distinct from health risk, and background assessment lifecycle states must never be confused with a clinical result.

## What Changes

- Define one presentation mapping for `scored`, `insufficient`, `processing`, `outdated`, and `error` states using the existing strict-readiness fields and assessment-job metadata; keep the mapping deterministic and server-backed where lifecycle information is available.
- Extend the Health Profile response metadata with an explicit assessment display state so the client does not infer stale/error semantics from incidental fields; preserve the latest completed snapshot while an update is pending or failed.
- Update body-map badges, connectors, chips, and the system drawer to use neutral insufficient styling, explicit state copy, em-dash placeholders, source/readiness explanations, and hover/focus tooltips that say current-state assessment rather than diagnosis or disease risk.
- Keep every system selector keyboard-operable with visible focus, Enter/Space activation, dialog semantics, and selection/deep-link synchronization; preserve safe same-origin `system` and `returnTo` navigation.
- Add responsive body-map sizing and compact system controls for narrow/mobile layouts without hiding systems or source evidence.
- Make overall assessment and update banners distinguish insufficient evidence from processing, outdated snapshots, and failed recalculation; expose retry only for retryable/failed updates and state that an older snapshot remains available when applicable.
- Keep factual disclaimers on the map, overall card, drawer, and lifecycle messaging; do not introduce diagnoses, treatment advice, disease-risk claims, red danger styling for insufficient evidence, Registry changes, or database migrations.

## Capabilities

### New Capabilities

- `health-profile-state-presentation`: Unified, accessible, non-diagnostic presentation of body-system readiness and assessment lifecycle states across the Health Profile, dashboard assessment widget, map, chips, drawer, and deep links.

### Modified Capabilities

<!-- No existing main capability spec is present in openspec/specs/; the new capability captures the EH-146 contract. -->

## Impact

- **Target domains:** `health-profile` presentation and `auth-shell` dashboard widget surfaces.
- **Frontend:** Health Profile page, body map/silhouette, system drawer, overall assessment card, dashboard health-assessment widget, and responsive global styles.
- **API contract:** `GET /api/health-profile` gains explicit lifecycle display metadata while retaining the existing nullable score/readiness payload.
- **Verification:** Deterministic state-mapping/body-map regression checks, TypeScript checks, targeted browser smoke coverage, and `QA/eh-146/checklist.md`.
- **Data/security:** No new persistence or authorization path; existing profile-scoped assessment reads, document links, and same-origin deep-link validation remain authoritative.
