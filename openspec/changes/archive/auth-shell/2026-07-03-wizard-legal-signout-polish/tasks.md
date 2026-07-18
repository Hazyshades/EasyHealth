## 1. Wizard visited progress

- [x] 1.1 Extend `PATCH /api/profile` to accept `wizard_step_visited: string` and merge into `dashboard_preferences.wizard_steps_visited`
- [x] 1.2 Return `wizard_steps_visited` from `GET /api/profile`
- [x] 1.3 Update `OnboardingWizard`: on Go click, persist visited step then `router.push(href)`
- [x] 1.4 Show checkmark when step is in `wizard_steps_visited` OR data-complete (existing API checks)
- [x] 1.5 Refetch wizard progress when overlay opens and on window `focus`/`visibilitychange`

## 2. Legal document pages

- [x] 2.1 Add `content/legal/privacy.md`, `terms.md`, `cookies.md` copied from repo source files (brackets unchanged)
- [x] 2.2 Add `react-markdown` (or existing markdown renderer) if not in project
- [x] 2.3 Create `LegalDocument` component with prose layout (title, sections, scrollable body)
- [x] 2.4 Replace placeholder content in `/legal/privacy`, `/legal/terms`, `/legal/cookies` pages
- [x] 2.5 Verify consent page links open correct full documents

## 3. Sign out redirect

- [x] 3.1 Update `signOut` in `wallet-provider.tsx` to redirect to `/` after session clear
- [x] 3.2 Verify sign out from top bar and any other sign-out entry points uses shared `signOut`

## 4. Profile button polish

- [x] 4.1 Fix **Complete registration** button on `/onboarding/profile` with explicit solid color and white text

## 5. Verification

- [x] 5.1 Manual test: Go on wizard step → upload page → back → step shows complete, progress updated
- [x] 5.2 Manual test: legal pages render full text with brackets intact
- [x] 5.3 Manual test: sign out from `/app` lands on `/`
