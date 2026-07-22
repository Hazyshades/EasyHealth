## Why

New users currently land in the full app immediately after Google wallet sign-in, with no guided profile setup, no explicit health-data consent, and a minimal dashboard that does not match the intended first-run experience. A structured onboarding funnel improves EU/US compliance, sets expectations before AI processing, and drives users toward core paid flows (upload, biomarkers, reports).

## What Changes

- Add a **full-screen profile gate** after first sign-in: first name required, last name optional; main app shell hidden until complete.
- Add a **full-screen consent gate** with separate required checkboxes (Terms, Privacy, health data, AI processing) and optional preferences, using copy from `acceptTerms.md`; unchecked by default.
- Add **server-side onboarding state** on `profiles` (name fields, consent timestamps/version, wizard dismissal/completion).
- Add a **getting-started wizard** overlay on the dashboard (skippable, completable via Done); steps aligned with EasyHealth MVP (upload → biomarkers → report), not doctor-role selection.
- Replace the current 3-card dashboard with a **4–5 widget grid**: three functional widgets tied to existing features plus two future-ready placeholder widgets (medications, water balance) that can be implemented later without layout changes.
- Add route guards in `/app` layout to enforce profile → consent order before showing `AppShell`.
- Stop auto-filling `display_name` from Google OAuth as the sole source of truth; pre-fill the profile form from OAuth but require explicit user submission.

## Capabilities

### New Capabilities

- `user-onboarding`: Full-screen profile and consent gates, onboarding state machine, and getting-started wizard overlay on the dashboard.
- `dashboard-widgets`: Home dashboard widget grid (4–5 cards), mix of live data widgets and extensible placeholder widgets for future wellness features.

### Modified Capabilities

- _(none — no existing OpenSpec capability specs in repo)_

## Impact

- **Database**: New migration on `profiles` (`first_name`, `last_name`, consent fields, onboarding timestamps, optional `dashboard_preferences` jsonb).
- **API**: Extend `PATCH /api/profile` (or add `POST /api/onboarding/*`) for profile completion, consent recording, wizard state.
- **Auth flow**: `wallet-provider.tsx` and `upsertProfileByWallet` — defer setting display identity until profile gate completes.
- **Routing**: New `/onboarding/profile`, `/onboarding/consent` routes with minimal layout; updates to `src/app/app/layout.tsx` guards.
- **UI**: New onboarding pages, `OnboardingWizard` component, dashboard widget system; English-only user-facing strings.
- **Out of scope**: Doctor portal, wearables, full implementation of medication/water/weight/sleep tracking, cookie banner (registration consent only in this change).
