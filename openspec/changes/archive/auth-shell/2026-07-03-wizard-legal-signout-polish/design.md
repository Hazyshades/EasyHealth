## Context

EasyHealth already has a welcome wizard overlay (`OnboardingWizard`), three legal route stubs, profile/consent onboarding gates, and Circle wallet sign-out that clears client/server session without navigation.

Source legal content lives in repo root:
- `Privacy Policy.md`
- `Terms of Service.MD`
- `COOCKE.MD`

User decision: **keep all `[bracket]` placeholders** — do not replace `[EasyHealth]`, `[Date]`, `[Company Address]`, etc.

Wizard decision: **visited immediately on Go** — not gated on upload/OCR/report completion.

## Goals / Non-Goals

**Goals:**

- Clicking **Go** on any wizard step marks it visited/completed immediately and navigates to the target route.
- Wizard progress persists across navigation (return to `/app` shows updated checkmarks and progress bar).
- Legal pages display full document text with readable typography.
- Sign out always lands on `/`.
- Profile **Complete registration** button is clearly visible (solid brand color, white text).

**Non-Goals:**

- Replacing legal placeholders with real company data.
- Cookie banner implementation (consent screen only; cookie policy is a read-only page).
- Changing wizard skip/done DB semantics (`onboarding_dismissed_at`, `onboarding_completed_at`).
- Landing page hero or 3-step marketing copy changes.

## Decisions

### 1. Wizard visited progress storage

Store visited step ids in existing `profiles.dashboard_preferences`:

```json
{
  "wizard_steps_visited": ["upload", "biomarkers", "report"]
}
```

**On Go click** (before navigation):

1. `PATCH /api/profile` with `{ wizard_step_visited: "upload" }` (or batch)
2. Optimistic UI checkmark + progress update
3. `router.push(step.href)`

**On dashboard mount** (wizard open): merge server `wizard_steps_visited` with optional API-derived completion (upload doc exists, etc.) — **visited OR data-complete** shows checkmark.

**Alternative considered:** sessionStorage only. Rejected — lost on new device/tab; server persistence is minimal cost.

### 2. Wizard refetch on return

`OnboardingWizard` and/or `/app/page.tsx`:

- Re-load profile preferences when `open` becomes true
- Optional: `visibilitychange` listener to refresh steps when user tabs back

### 3. Legal pages architecture

```
content/legal/
  privacy.md      ← copy from Privacy Policy.md
  terms.md        ← copy from Terms of Service.MD
  cookies.md      ← copy from COOCKE.MD

src/components/legal/legal-document.tsx  — prose layout
src/app/legal/[slug]/page.tsx          — OR keep 3 explicit routes
```

Render with `react-markdown` + `prose` Tailwind classes. Preserve markdown headings, lists, bold, links.

Keep bracket placeholders verbatim in stored markdown.

Legal pages: **public** (no auth required), minimal layout (no AppShell).

### 4. Sign out redirect

In `wallet-provider.tsx` `signOut`:

```ts
await fetch("/api/auth/session", { method: "DELETE" });
// clear storage + state...
window.location.href = "/";  // hard nav clears any stale RSC cache
```

Use hard navigation to avoid staying on `/app/*` with empty session.

### 5. Profile button fix

Apply same pattern as consent Continue button:

```tsx
className="h-11 w-full rounded-xl border-0 bg-[#2563eb] font-semibold text-white ..."
```

Or `!bg-[var(--eh-brand)] !text-white` to override shadcn `bg-primary`.

## Risks / Trade-offs

- **[Risk] Wizard “complete” without real upload** → Acceptable per product choice; still encourages flow via Go CTAs.
- **[Risk] Legal text not lawyer-reviewed** → Placeholders remain; MVP display only.
- **[Risk] Large markdown bundle** → Three static imports; negligible for hackathon.
- **[Trade-off] Duplicating legal files** → Copy into `content/legal/` for stable imports; note in tasks to sync if root files change.

## Migration Plan

No DB migration required if `dashboard_preferences` jsonb already exists. Deploy UI + API patch for `wizard_step_visited`. Legal content is static.

## Open Questions

- None blocking — user confirmed visited-on-Go, bracket placeholders, and sign-out redirect.
