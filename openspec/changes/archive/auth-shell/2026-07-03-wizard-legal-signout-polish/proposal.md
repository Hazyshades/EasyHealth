## Why

The first-run experience has gaps: welcome wizard steps only complete after backend data exists (not when the user clicks Go), legal pages are placeholders while consent links promise real policies, the profile registration button is nearly invisible, and sign-out clears session but leaves the user on protected app routes. These polish items close the onboarding loop and align UX with EU/US legal positioning.

## What Changes

- **Welcome wizard**: Mark a step as completed immediately when the user clicks **Go** (intent/visited model), persist progress server-side, and refetch when returning to the dashboard.
- **Legal pages**: Replace `/legal/privacy`, `/legal/terms`, and `/legal/cookies` placeholders with full content from `Privacy Policy.md`, `Terms of Service.MD`, and `COOCKE.MD`. Keep all `[bracket]` placeholders as-is (no substitution).
- **Sign out**: After session deletion, redirect the user to the landing page (`/`).
- **Profile gate button**: Fix **Complete registration** button styling so it uses a visible solid brand color (same issue as consent Continue button).

## Capabilities

### New Capabilities

- `wizard-step-visited`: Immediate step completion on Go, persisted progress, dashboard refetch on return.
- `legal-document-pages`: Render full legal markdown documents on dedicated routes with readable layout.
- `sign-out-redirect`: Sign out clears wallet/session state and navigates to landing.

### Modified Capabilities

- _(none — prior `user-onboarding-dashboard` change not yet archived to main specs)_

## Impact

- **UI**: `OnboardingWizard`, `/app/page.tsx`, `/onboarding/profile`, `/legal/*`
- **Data**: `profiles.dashboard_preferences` jsonb — store `wizard_steps_visited: string[]` (no migration if jsonb field already exists)
- **Auth**: `wallet-provider.tsx` `signOut` — add `router.push('/')` or `window.location.href = '/'`
- **Content**: Copy legal markdown into `content/legal/` or load from repo root files; may add `react-markdown` if not present
- **Dependencies**: Optional markdown renderer for legal prose styling
