# User Onboarding Platform Tour QA Checklist

## Preconditions

- Run the app against a local or disposable Supabase environment with migration `077_platform_tour.sql` applied.
- Use a dedicated synthetic test account. Do not upload real health information.
- Prepare one non-sensitive sample lab PDF or image containing fake values.
- Have one account with no Profile name or current consent, one ready account with no tour decision, and one account with a current tour decision.
- Test once at a desktop viewport (at least 1024 px wide) and once at a mobile viewport (375 px wide).

## Manual product checks

### 1. Mandatory Profile and consent gates

- [ ] Sign in with the incomplete test account.
- [ ] Confirm the app shell is not visible while the Profile gate is active.
- [ ] Submit an empty first name and confirm a validation error appears without navigation.
- [ ] Submit a first name and continue to consent.
- [ ] Confirm Terms, Privacy, health-data processing, AI processing, and optional preference controls all start unchecked.
- [ ] Confirm Continue remains disabled until all four required controls are checked.
- [ ] Submit all required consents and confirm the app redirects to `/app`.
- [ ] Reload `/app` and confirm the mandatory gates do not reappear when all three consent timestamps and the current terms version are present.

### 2. First-run platform tour

- [ ] Open `/app` with a ready account whose current tour version has no terminal decision.
- [ ] Confirm the dashboard remains visible and usable behind the overlay.
- [ ] Confirm the introduction, navigation, Add document, Reports, Biomarkers, Health Profile, and Account targets appear in the expected order when those targets are rendered.
- [ ] Confirm the progress indicator, Next, Back, close, and Finish tour controls are visible and written in English.
- [ ] Confirm the tour does not navigate away from `/app` when advancing through steps.

### 3. Dismissal and completion persistence

- [ ] Close the tour with the close control on a non-final step; reload `/app` and confirm the current tour does not start again.
- [ ] Repeat with Escape and confirm the same dismissal behavior.
- [ ] Reset the test account's current tour state through the disposable database, complete the final step with Finish tour, and confirm the tour does not start again after reload.
- [ ] Confirm completion shows the existing “You’re all set!” banner.
- [ ] Dismiss the banner and reload; confirm it remains hidden.
- [ ] Change the current tour version in the disposable database to a newer value and confirm the tour becomes eligible again; do not mark this as tested if no version-change fixture is available.

### 4. Responsive target selection

- [ ] At desktop width, confirm the highlighted navigation target is the visible sidebar and the mobile bottom navigation is not highlighted.
- [ ] At mobile width, confirm the highlighted navigation target is the visible bottom navigation and the desktop sidebar is not highlighted.
- [ ] At mobile width, confirm the Biomarkers step targets the mobile navigation item.
- [ ] At desktop width, confirm the Biomarkers step targets the desktop navigation item.

### 5. Accessibility and motion

- [ ] Navigate the tour with keyboard controls only; confirm focus remains usable and Escape dismisses the tour.
- [ ] Enable the browser/OS reduced-motion preference, reload `/app`, and confirm the tour still works without animated transitions.
- [ ] Confirm the page remains scrollable and the active target is not permanently obscured after the tour closes.

### 6. Target readiness and error recovery

- [ ] Throttle the dashboard requests in browser developer tools and confirm the tour does not start over the loading skeleton.
- [ ] With an optional target intentionally absent in a disposable development fixture, confirm the tour skips it without an uncaught error.
- [ ] If a required navigation target is unavailable after readiness, confirm the dashboard remains usable and the tour does not start.
- [ ] Open an invalid or expired auth callback code and confirm the landing page shows a safe English recovery message with no raw provider/database error.
- [ ] If Profile setup failure injection is available in the disposable environment, confirm the landing page offers retry/setup guidance and does not present the Profile as ready. Otherwise record this step as not tested and attach the server log plus verifier evidence.

## Developer evidence

- [ ] `pnpm test:user-onboarding-platform-tour`
- [ ] `pnpm test:app-navigation-hot-path`
- [ ] `pnpm typecheck`
- [ ] `openspec validate user-onboarding-platform-tour --strict --no-interactive`
- [ ] Review the Network panel: the Platform Tour must not fetch documents, biomarkers, or reports solely to decide which step is complete.
- [ ] Review the Profile PATCH payloads: only `dismiss_tour`, `complete_tour`, or `dismiss_banner` is sent for tour/banner state.
- [ ] Confirm migration `077_platform_tour.sql` is applied in the disposable environment before recording database results.

## Limitations

Do not mark unavailable OAuth provider setup, remote Wiki publication, or fault-injection-only Profile failures as tested. Record the exact environment limitation and the evidence required for a human follow-up.
