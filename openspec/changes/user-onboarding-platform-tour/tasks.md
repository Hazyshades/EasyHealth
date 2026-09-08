## 1. Persistence and onboarding policy

- [x] 1.1 Add the Driver.js dependency and the `onboarding_tour_version` Profile migration with current-version defaults.
- [x] 1.2 Extend the Profile projection and pure onboarding policy to evaluate all required consent facts, current terms version, tour version, and banner state.
- [x] 1.3 Replace wizard-specific Profile mutations and response fields with versioned `dismiss_tour`, `complete_tour`, and banner actions; clear the opposite terminal state on each transition.

## 2. Auth and consent contract

- [x] 2.1 Initialize every consent checkbox unchecked and make the onboarding pages consume the canonical consent gate decision.
- [x] 2.2 Make Profile ensure failure fail closed on onboarding entry and expose a stable recoverable callback/setup error without raw provider or database details.
- [x] 2.3 Separate Auth user identity from Profile readiness in `AuthProvider` and update landing/app-shell consumers without fabricating a ready Profile id.

## 3. Platform Tour module

- [x] 3.1 Add stable semantic tour markers for desktop navigation, mobile navigation, dashboard actions, Health Profile/biomarker surface, reports, and account controls.
- [x] 3.2 Implement the client-only Platform Tour module behind a small interface using Driver.js, with explicit steps, readiness gating, missing-target handling, keyboard controls, reduced-motion behavior, and EasyHealth theming.
- [x] 3.3 Replace the dashboard `OnboardingWizard` mount with the Platform Tour and preserve the current completion banner behavior for the current tour version.
- [x] 3.4 Remove runtime wizard-step fetching, persistence, imports, and obsolete component code after all callers use the new tour actions.

## 4. Verification and QA

- [x] 4.1 Add focused verification for consent defaults, stale/partial consent, tour version transitions, terminal action semantics, and Profile-unavailable state.
- [x] 4.2 Add browser/manual QA coverage for first-run, skip, close, finish, returning user, mobile, reduced motion, delayed targets, and callback/setup errors.
- [x] 4.3 Run the app-navigation hot-path check, targeted onboarding verification, and typecheck; resolve regressions without disturbing pre-existing user changes.
- [x] 4.4 Update the OpenSpec task checkboxes and record the implementation evidence in the linked GitHub issue #244.
