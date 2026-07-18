## Context

EasyHealth uses Circle Google wallet auth → session cookie → `profiles` row. Today `display_name` is auto-populated from OAuth first name, and authenticated users enter `/app` immediately with `AppShell` (sidebar + top bar). There is no consent capture despite processing health data and AI extraction. The dashboard shows three static cards (records count, assessment, reports).

Reference UX: full-screen gates for profile and legal consent, then app shell with a skippable getting-started overlay, then a widget-based home dashboard. Product constraints: EN-first UI, wellness positioning (not diagnostic), hackathon MVP scope, Supabase + Next.js App Router patterns.

## Goals / Non-Goals

**Goals:**

- Enforce ordered first-run flow: profile → consent → app with wizard → widget dashboard.
- Store auditable consent (timestamps + version) and onboarding completion flags server-side.
- Require explicit first name; allow optional last name.
- Pre-fill profile form from Google OAuth but require user submit.
- Getting-started wizard promotes upload ($0.01), biomarkers, and report ($0.05); skippable.
- Dashboard with 5 widgets: 3 functional (assessment, upload/documents, reports) + 2 future-ready stubs (medications, water balance).
- All user-facing copy in English.

**Non-Goals:**

- Doctor role selection, clinic portal, wearables integration.
- Full implementation of medications, water, weight, sleep, weather, tasks widgets.
- Separate cookie banner (only registration consent screen in this change).
- Family profiles, dashboard drag-and-drop reorder (static order for now).
- Legal review of Terms/Privacy documents themselves (use provided copy; link placeholders OK).

## Decisions

### 1. Onboarding state on `profiles` table

Add columns via migration `010_profile_onboarding.sql`:

| Column | Type | Purpose |
|--------|------|---------|
| `first_name` | `text` | Required for onboarding complete |
| `last_name` | `text` nullable | Optional |
| `terms_accepted_at` | `timestamptz` | Required gate |
| `terms_version` | `text` | e.g. `2026-06-29` |
| `health_data_consent_at` | `timestamptz` | GDPR Art. 9 explicit |
| `ai_consent_at` | `timestamptz` | AI processing explicit |
| `consent_preferences` | `jsonb` default `{}` | Optional flags (analytics, marketing, etc.) |
| `onboarding_dismissed_at` | `timestamptz` | Wizard skipped |
| `onboarding_completed_at` | `timestamptz` | Wizard finished via Done |
| `dashboard_preferences` | `jsonb` default `{}` | Future widget visibility/order |

Keep `display_name` for backward compatibility: set to `first_name` (or `first_name + last_name` if last name provided) on profile save. Greeting uses `first_name` + optional `last_name` initial or full last name in top bar.

**Alternative considered:** separate `user_consents` table. Rejected for hackathon — single profile row is sufficient.

### 2. Route structure and guards

```
/onboarding/profile     → minimal layout (no AppShell)
/onboarding/consent     → minimal layout
/app/*                  → AppShell + server guard
```

Guard logic in `src/app/app/layout.tsx` (server component):

1. No session → redirect `/?signin=required`
2. Load profile onboarding fields
3. `first_name` missing → redirect `/onboarding/profile`
4. `terms_accepted_at` null → redirect `/onboarding/consent`
5. Else render `AppShell`

`/onboarding/*` layout: session required; if profile already complete, redirect forward (profile done → consent or app).

**Alternative considered:** middleware.ts. Rejected — existing pattern uses layout redirect; keeps profile fetch in one place.

### 3. Profile gate UX

- Full viewport centered card, white background, no sidebar/topbar.
- Fields: First name (required), Last name (optional).
- Pre-fill from `oauthResult.socialUserInfo.name` split into first/last.
- Submit → `PATCH /api/profile` with `{ first_name, last_name }` → redirect `/onboarding/consent`.
- Do not pass `displayName` to `establishSession` on first login; only set after form submit.

### 4. Consent gate UX

Copy from `acceptTerms.md` (English). Four required unchecked checkboxes + four optional unchecked checkboxes. Continue disabled until all required checked.

Submit → `PATCH /api/profile` with consent payload → set timestamps server-side (client cannot forge `terms_accepted_at`). Redirect `/app`.

Store `terms_version` constant in `src/lib/consent.ts` (e.g. `CURRENT_TERMS_VERSION`).

Links: Privacy Policy, Terms of Service, Cookie Policy — placeholder routes or external URLs in env (`NEXT_PUBLIC_TERMS_URL`, etc.).

### 5. Getting-started wizard (client overlay)

Component `OnboardingWizard` mounted in `src/app/app/page.tsx` when:

- `onboarding_dismissed_at` and `onboarding_completed_at` are both null, AND
- client has not dismissed in session (optional)

Steps (0/3 progress):

| Step | Title | CTA | Auto-complete when |
|------|-------|-----|-------------------|
| 1 | Upload your first lab | `/app/upload` | ≥1 completed document |
| 2 | View your biomarkers | `/app/biomarkers` | ≥1 observation |
| 3 | Generate a health report | `/app/reports/create` | ≥1 report |

Actions:

- **Skip** → `PATCH` set `onboarding_dismissed_at` → close wizard
- **Done** → `PATCH` set `onboarding_completed_at` → close wizard + show success banner once

Modal overlays dashboard content; `AppShell` remains visible (dimmed), matching reference screen 2.

### 6. Dashboard widget architecture

Registry pattern `src/lib/dashboard/widgets.ts`:

```ts
type WidgetId = 'assessment' | 'upload' | 'reports' | 'medications' | 'water_balance';

type WidgetDef = {
  id: WidgetId;
  status: 'live' | 'coming_soon';
  component: React.ComponentType<WidgetProps>;
};
```

Default grid order (5 widgets):

1. **Health assessment** (`live`) — reuse `OverallAssessmentCard` / empty state
2. **Upload lab** (`live`) — CTA card linking to `/app/upload`
3. **Health reports** (`live`) — reuse `ReportsDashboardCard`
4. **Medications** (`coming_soon`) — stub card: "Add medications" / "Coming soon"
5. **Water balance** (`coming_soon`) — stub card: "0 ml of 2.0 L" placeholder UI, non-functional add button

Layout: responsive CSS grid `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` on `/app`.

Post-wizard banner: dismissible `SurfaceCard` — "You're all set!" shown when `onboarding_completed_at` set and user has not dismissed banner (store `dashboard_banner_dismissed_at` in `dashboard_preferences` or localStorage for simplicity).

**Alternative considered:** 9-widget Lissa grid. Rejected — scope 5 widgets, 2 stubs only.

### 7. API changes

Extend `PATCH /api/profile` schema:

```ts
{
  first_name?: string;      // min 1
  last_name?: string | null;
  consents?: {
    terms: boolean;
    privacy: boolean;
    health_data: boolean;
    ai_processing: boolean;
    analytics?: boolean;
    personalization?: boolean;
    marketing_email?: boolean;
    marketing_cookies?: boolean;
  };
  onboarding_action?: 'dismiss_wizard' | 'complete_wizard';
}
```

Server validates: consent fields only accepted if all four required booleans true; sets timestamps atomically.

Add `GET /api/profile` fields for onboarding state (for wizard + guards).

### 8. Existing user migration

Users with `display_name` set but `first_name` null: backfill `first_name = display_name` in migration SQL. They still must pass consent gate (`terms_accepted_at` null → show consent only, skip profile if name exists).

New users: `first_name` null until form submit.

## Risks / Trade-offs

- **[Risk] Consent without legal sign-off** → Use `acceptTerms.md` copy verbatim; version string enables re-consent later.
- **[Risk] Stub widgets feel broken** → Clear "Coming soon" label; no fake data entry that silently fails.
- **[Risk] Double redirect loops** → Onboarding layouts redirect forward when step already complete; unit-test guard order.
- **[Risk] OAuth name bypasses profile gate** → `establishSession` stops sending `displayName` on create; guard checks `first_name` not `display_name`.
- **[Trade-off] `display_name` duplication** → Kept for existing menu/avatar code; synced from `first_name` on save.

## Migration Plan

1. Run Supabase migration `010_profile_onboarding.sql` (add columns + backfill `first_name` from `display_name`).
2. Deploy API + onboarding routes.
3. Deploy app layout guard — existing users hit consent screen once.
4. Rollback: remove guard redirects (feature flag `ONBOARDING_ENABLED` optional); columns are additive, safe to leave.

## Open Questions

- Final URLs for Terms/Privacy/Cookie policy pages (env vars vs `/legal/*` static pages).
- Whether success banner uses server `dashboard_preferences` or `localStorage` only (recommend server field in `dashboard_preferences`).
