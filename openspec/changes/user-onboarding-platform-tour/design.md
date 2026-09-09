## Context

EasyHealth has two different post-auth concerns that are currently represented as one onboarding surface:

```text
Supabase Auth session
        |
        v
Profile name gate -> consent gate -> authenticated app shell -> getting-started wizard
                                                       |
                                                       v
                                           dashboard / documents / biomarkers / reports
```

The Profile and consent gates are mandatory domain policy. The current `OnboardingWizard` is optional product education, but its implementation is a modal checklist that fetches four resources, derives task completion, persists `wizard_steps_visited`, and navigates away from the dashboard. It is not a reliable explanation of the app shell.

The change introduces a small client-side Platform Tour module at the seam between the ready app shell and product education. Driver.js is a true external dependency and remains behind that module. The first implementation stays on `/app`; it does not attempt to keep one Driver.js instance alive across Next route changes.

The current working tree contains unrelated, uncommitted visual adjustments to the onboarding screens and shared button styles. The implementation MUST preserve those user changes and edit only the files required by this change.

## Goals / Non-Goals

**Goals:**

- Keep Supabase session, Profile-name, and consent gates authoritative and ordered.
- Replace the post-gate checklist modal with a non-blocking Driver.js platform orientation tour.
- Define a small Platform Tour interface that owns step definitions, target selection, lifecycle, reduced-motion behavior, and terminal persistence.
- Start the tour only after the dashboard is ready and stable targets exist.
- Support desktop and mobile target sets without relying on text or fragile CSS selectors.
- Persist skip/completion and a tour version so later tour versions can be introduced deterministically.
- Correct consent readiness so all required facts and the current terms version are required.
- Keep Auth user identity distinct from Profile readiness on the client and server.
- Provide focused source/behavior verification and a manual QA checklist.

**Non-Goals:**

- Changing Google OAuth, email magic-link provider configuration, or Supabase session ownership.
- Reopening end-user RLS work; server routes continue to use the existing server-side session and service-role adapter pattern.
- Building a multi-route interactive tutorial in this change.
- Tracking whether a user completed upload, biomarker review, or report generation as part of the Platform Tour.
- Replacing the Knowledge Base or explaining clinical meaning inside the tour.
- Adding analytics or a new telemetry pipeline.

## Decisions

### 1. Separate mandatory gates from optional product education

The existing onboarding policy remains the external seam for access decisions:

- no session redirects to sign-in;
- missing first name redirects to Profile onboarding;
- incomplete or stale consent redirects to consent onboarding;
- only a ready Profile reaches `/app`.

The Platform Tour is evaluated only after the app shell is admitted. It never controls access and never replaces the server-side gate. The existing `user-onboarding` spec is modified to remove the wizard requirement, while the new `platform-tour` spec owns tour behavior.

### 2. Use a single-page Driver.js tour for the first version

Add `driver.js` as a client dependency and hide it behind a Platform Tour module. The module exposes only the behavior callers need: start when ready, destroy/skip, and finish. Page callers do not import Driver.js or own step definitions.

The initial step set targets the dashboard and app shell only:

1. centered introduction;
2. desktop sidebar or mobile navigation;
3. Add document / upload entry point;
4. Reports entry point;
5. Biomarkers entry point;
6. Health Profile or dashboard health surface;
7. finish state.

The module chooses a desktop or mobile step set before starting. It starts only when the dashboard has finished its initial loading and at least one target is present. Missing optional targets are skipped; missing required shell targets prevent the tour from starting rather than producing a broken centered popover.

**Alternative rejected:** a first-version multi-route tutorial. Driver.js instances are page-scoped; cross-route continuation requires storing a step, destroying the instance, waiting for the next route's DOM, and resuming. That complexity is justified only after the orientation tour proves useful.

### 3. Use semantic target markers and preserve app navigation

Add stable `data-tour` markers to the shell and dashboard surfaces. Targets are selected by semantic marker, not visible text, generated class names, or DOM position. Desktop sidebar and mobile bottom navigation receive distinct markers so hidden elements are never selected accidentally.

The tour allows normal interaction with the highlighted target. The first version uses explicit Next/Back/Skip controls rather than `advanceOnClick`, so a user cannot accidentally navigate away while learning the interface.

### 4. Persist terminal state with an explicit tour version

Reuse the existing Profile onboarding timestamps as terminal state, but add a dedicated `onboarding_tour_version` column with a default version of `1`.

The server-side transition module exposes only terminal actions:

- `dismiss_tour`: set dismissal timestamp, clear completion timestamp, set current version;
- `complete_tour`: set completion timestamp, clear dismissal timestamp, set current version;
- `dismiss_banner`: update dashboard banner preferences.

`showPlatformTour` is true when the current version has no terminal state. A later version is eligible even when an older version was dismissed or completed. The success banner is shown only for a completion recorded for the current version.

Wizard-specific `wizard_steps_visited` persistence and `markWizardStepVisited` are removed from the runtime interface. Existing JSON keys are not used by the new implementation; a migration may remove the obsolete key if the final SQL remains safe for deployed data.

**Alternative rejected:** localStorage-only persistence. It would lose the user's decision across devices and contradicts the existing server-side onboarding contract.

**Alternative rejected:** reusing `wizard_steps_visited` for tour progress. A visual tour step is not evidence that the user completed a product workflow, so task completion and tour completion must not share state.

### 5. Make consent readiness complete and version-aware

`profileOnboardingStateFromRow` becomes the single policy implementation for consent readiness. The consent gate requires:

- `terms_accepted_at`;
- `health_data_consent_at`;
- `ai_consent_at`;
- `terms_version === CURRENT_TERMS_VERSION`.

The consent UI initializes every required and optional checkbox to `false`. The server remains authoritative for timestamps and terms version.

The onboarding pages and dashboard consume the canonical onboarding projection returned by the Profile route instead of reimplementing raw timestamp checks in each caller.

### 6. Keep Auth user and Profile readiness distinct

The server `getSessionProfileIdEnsured` path MUST NOT return an Auth user id after Profile ensure failure. It throws/logs a controlled Profile setup failure; the onboarding layout maps that failure to a recoverable sign-in/setup error rather than rendering a Profile-dependent page.

`AuthProvider` exposes explicit client state for Auth user identity and Profile readiness. A failed `/api/profile` read does not fabricate a Profile id. Existing callers use the ready Profile state for account controls and app links, while an authenticated-but-unavailable state can render a recoverable error.

Callback errors use stable safe reason codes rather than forwarding raw provider messages in a redirect query. The landing surface consumes those codes and offers the existing magic-link retry path.

### 7. Accessibility, motion, and lifecycle

Configure Driver.js with keyboard control and close behavior enabled. The tour is dismissible from every step and does not lock page scroll. When `prefers-reduced-motion: reduce` is active, the module disables Driver.js animation.

The module destroys its instance on unmount, route transition, or terminal action. React Strict Mode or dashboard refetches must not start duplicate instances. Driver.js styling is loaded once through the app-wide style layer and customized to the existing EasyHealth tokens.

### 8. Verification at the seam

Pure onboarding policy tests cover consent facts, terms-version transitions, tour visibility, and banner visibility. Focused source/behavior checks cover terminal action names, removal of wizard step persistence, stable target markers, and no tour start before readiness.

Manual QA covers:

- new user after consent;
- skip, close, and finish;
- returning user with current terminal state;
- a later tour version;
- desktop and mobile navigation;
- reduced motion and keyboard controls;
- delayed/missing dashboard targets;
- Profile-unavailable and callback error states;
- regression of the app-navigation hot path.

## Risks / Trade-offs

- **[Risk] Driver.js styling may not match the EasyHealth design system.** → Load its stylesheet once, scope a custom popover class, and verify overlay, typography, buttons, z-index, and darkened shell in the browser.
- **[Risk] Hidden desktop/mobile targets can be selected accidentally.** → Use distinct semantic markers and select the target set from the active viewport before starting.
- **[Risk] A target can be absent while dashboard data is loading or after a future layout change.** → Gate start on readiness, skip optional targets, and do not start when required shell targets are absent.
- **[Risk] Existing users have legacy wizard timestamps but no explicit tour version.** → Add a database default version so existing rows receive version `1`; terminal actions always write the current version.
- **[Risk] Removing wizard step state may strand callers.** → Migrate all current callers in one cutover, remove the old PATCH field and helper, and add a source guard preventing runtime references.
- **[Risk] Fail-closed Profile handling can expose a new setup error instead of silently continuing.** → Use a stable English error state with retry/sign-in guidance; do not claim the Profile is ready when it is not.
- **[Risk] The optional tour adds client work to `/app`.** → Start only after the existing dashboard data is ready, avoid additional data fetches, and dynamically load the Driver.js module if measurement shows bundle impact.
- **[Trade-off] The first tour explains location rather than completing workflows.** → Keep the task-oriented upload/review/report tutorial as a separate future capability instead of conflating tour completion with health-data progress.

## Migration Plan

1. Add the `onboarding_tour_version` Profile column with default version `1`.
2. Add Driver.js and its app-wide stylesheet, then add the Platform Tour module and semantic targets.
3. Replace dashboard wizard mounting and remove runtime wizard-step reads/writes.
4. Update the Profile route and onboarding policy projection for tour state and complete consent facts.
5. Update AuthProvider/onboarding layout error semantics and callback error presentation.
6. Run focused verification, app-navigation hot-path verification, and manual browser QA.

Rollback is a single app release rollback plus the additive Profile column. The old timestamp fields remain compatible during rollout; the old wizard code is removed only after all callers use the new tour actions.

## Open Questions

- None blocking implementation. The first version is intentionally dashboard-only; a later multi-route tutorial should be proposed as a separate capability after observing this tour in use.
