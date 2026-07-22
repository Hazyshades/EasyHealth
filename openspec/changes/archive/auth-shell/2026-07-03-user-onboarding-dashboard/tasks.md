## 1. Database and profile model

- [x] 1.1 Add migration `010_profile_onboarding.sql` with `first_name`, `last_name`, consent timestamps, `terms_version`, `consent_preferences`, onboarding timestamps, `dashboard_preferences`
- [x] 1.2 Backfill `first_name` from existing `display_name` for current users in migration
- [x] 1.3 Extend `ProfileRow` type and `getProfileById` select in `src/lib/auth/profile.ts`
- [x] 1.4 Add `updateProfileOnboarding`, `recordProfileConsents`, and wizard state helpers in `src/lib/auth/profile.ts`
- [x] 1.5 Add `src/lib/consent.ts` with `CURRENT_TERMS_VERSION` and consent validation helpers
- [x] 1.6 Add migration `011_dashboard_widgets.sql` — widget catalog, `weight_entries`, `water_intake_logs`, `medications`

## 2. API

- [x] 2.1 Extend `GET /api/profile` to return onboarding fields (`first_name`, `last_name`, consent flags, wizard state)
- [x] 2.2 Extend `PATCH /api/profile` Zod schema for `first_name`, `last_name`, `consents`, `onboarding_action`
- [x] 2.3 Implement server-side consent timestamp recording (reject partial required consents)
- [x] 2.4 Sync `display_name` from `first_name` (+ optional `last_name`) on profile save

## 3. Auth flow adjustments

- [x] 3.1 Stop auto-setting `displayName` in `establishSession` on first login in `wallet-provider.tsx`
- [x] 3.2 Update `menuDisplayLabel` / greeting to use `first_name` and optional `last_name`
- [x] 3.3 Add `getProfileOnboardingState(profileId)` helper for server layout guards

## 4. Onboarding routes (full-screen gates)

- [x] 4.1 Create `src/app/onboarding/layout.tsx` — minimal layout, session required, forward redirects when step complete
- [x] 4.2 Create `src/app/onboarding/profile/page.tsx` — first name required, last name optional, OAuth pre-fill, full-screen UI
- [x] 4.3 Create `src/app/onboarding/consent/page.tsx` — required + optional checkboxes from `acceptTerms.md`, Continue gated
- [x] 4.4 Add legal link placeholders (env URLs or `/legal/*` stubs) for Terms, Privacy, Cookie Policy

## 5. App layout guards

- [x] 5.1 Update `src/app/app/layout.tsx` to load profile onboarding state and redirect to `/onboarding/profile` or `/onboarding/consent` when incomplete
- [x] 5.2 Verify no redirect loops between onboarding and app routes

## 6. Getting-started wizard

- [x] 6.1 Create `OnboardingWizard` component — modal overlay, 3 MVP steps, progress 0/3, Skip and Done actions
- [x] 6.2 Wire wizard visibility in `src/app/app/page.tsx` based on profile onboarding timestamps
- [x] 6.3 Add step auto-complete hints when user has documents, observations, or reports (optional visual checkmarks)
- [x] 6.4 Create dismissible success banner component shown after wizard Done

## 7. Dashboard widgets

- [x] 7.1 Create `src/lib/dashboard/widgets.ts` registry with widget ids, status (`live` | `coming_soon`), and default order
- [x] 7.2 Extract/refactor live widgets: Health assessment, Upload lab, Health reports components
- [x] 7.3 Create placeholder widgets: Medications (`coming_soon`), Water balance (`coming_soon`), Weight trend (`coming_soon`)
- [x] 7.4 Replace current 3-card grid in `src/app/app/page.tsx` with widget grid renderer
- [x] 7.5 Preserve empty-state upload CTA when user has no completed documents

## 8. Polish and verification

- [x] 8.1 Ensure all new UI strings are English-only
- [x] 8.2 Manual test: new user flow profile → consent → wizard → dashboard
- [x] 8.3 Manual test: existing user with `display_name` sees consent only, then app
- [x] 8.4 Manual test: Skip wizard, Done wizard, and banner dismiss paths
