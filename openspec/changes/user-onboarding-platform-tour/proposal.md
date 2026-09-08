## Why

EasyHealth currently presents a `Welcome! / Get started with EasyHealth` checklist after authentication. The checklist launches three workflows, but it does not introduce the authenticated app shell as a coherent product and spreads onboarding state across dashboard, profile, consent, and persistence code. The onboarding contract has also drifted: required consent controls currently start checked and gate resolution considers only `terms_accepted_at`, while client fallback paths can conflate an authenticated Auth user with a ready Profile.

This change makes post-auth onboarding explicit: mandatory Profile and consent gates remain authoritative, followed by a non-blocking Driver.js platform tour that explains where the main health-data workflows live.

## What Changes

- **BREAKING** Replace the post-gate `OnboardingWizard` checklist UI with a versioned, dismissible platform tour built on Driver.js.
- Add a `platform-tour` capability covering a first-run dashboard/app-shell orientation, stable semantic targets, desktop/mobile behavior, keyboard dismissal/navigation, reduced-motion behavior, and terminal persistence.
- Keep the first tour single-page and non-blocking. Multi-route task tutorials and clinical education remain out of scope.
- Modify the `user-onboarding` contract so Profile and consent gates remain ordered and blocking, while the platform tour starts only after those gates pass.
- Correct consent behavior: required and optional controls start unchecked; readiness requires all required consent facts and the current terms version.
- Make missing or unreadable Profile state explicit instead of presenting an authenticated-looking Profile fallback.
- Remove wizard-specific per-step completion semantics from the public onboarding surface unless the design proves they are still needed for the platform tour.
- Add focused verification and manual QA for first-run, returning, skipped, completed, mobile, reduced-motion, delayed-target, and Profile-unavailable states.

## Capabilities

### New Capabilities

- `platform-tour`: Optional post-gate orientation tour for the authenticated EasyHealth app shell and core health-data entry points.

### Modified Capabilities

- `user-onboarding`: Change the post-gate experience from a getting-started wizard to an optional platform tour and tighten consent readiness semantics.
- `supabase-auth`: Keep Auth user identity distinct from Profile readiness during onboarding and fail closed when Profile setup or hydration is unavailable.

## Impact

- **Domain:** `auth-shell`.
- **UI:** `src/components/onboarding/onboarding-wizard.tsx`, dashboard mounting in `src/app/app/page.tsx`, app shell navigation and account targets, new Driver.js styling and client tour module.
- **Auth/Profile:** `src/lib/auth/onboarding.ts`, `src/lib/auth/session.ts`, `src/lib/auth/profile.ts`, `/api/profile`, onboarding pages, and callback/error handling as required by the final design.
- **Persistence:** Existing onboarding/profile persistence may be extended with an explicit tour-version fact; wizard-specific step persistence must be removed or intentionally migrated.
- **Dependencies:** Add Driver.js as a client-side dependency; no new remote runtime dependency.
- **Verification:** Update the existing onboarding/auth focused checks and add browser/manual QA evidence without regressing the app-navigation hot path.
- **Tracking:** GitHub issue #244; related roadmap context is #60 (EH-160).
