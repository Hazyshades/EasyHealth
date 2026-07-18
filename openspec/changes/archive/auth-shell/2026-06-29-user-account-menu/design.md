## Context

EasyHealth authenticates via Circle user-controlled wallets with Google social login. The top bar (`src/components/layout/top-bar.tsx`) exposes wallet USDC balance (`WalletAccountTrigger`) and **Sign out** only. `profiles` has `display_name` but it is never populated. All LLM calls hardcode `openai("gpt-4o-mini")` with `OPENAI_API_KEY` from server env.

Users want a familiar account menu pattern: first name on a button, links to account/settings, and a simple AI preference (ChatGPT vs DeepSeek) without BYOK, custom API keys, or custom base URLs.

Constraints from `easyhealth.mdc`: EN-first UI, minimize diff scope, x402 unchanged, medical safety unchanged, wallet_address auth key.

## Goals / Non-Goals

**Goals:**

- Show Google **first name** on a user menu button in the top bar, positioned **between** wallet balance and sign out.
- Dropdown links: **Account**, **Settings**, **AI Settings** (all English).
- `/app/account` shows wallet address, truncated Circle identity context, and profile id metadata.
- `/app/settings/ai` lets user pick **ChatGPT** or **DeepSeek**; preference persists per profile and applies to all server LLM calls (upload OCR/extraction, report generation).
- Default provider: **ChatGPT** (`openai`) when preference unset.
- Fetch first name from Circle on login and persist for menu label across sessions.

**Non-Goals:**

- User-supplied API keys, custom URLs, Anthropic, or other providers.
- Changes to x402 payment amounts or middleware behavior.
- Account menu item for Health Profile (`/app/profile` stays sidebar-only).
- Encrypting/storing third-party secrets client-side.
- General settings beyond a minimal shell page (notifications, locale, etc.).

## Decisions

### 1. User menu placement and component

**Decision:** Add `UserMenu` client component in `top-bar.tsx` order:

`[UserMenu] → [WalletAccountTrigger] → [Sign out]`

Use a dropdown (add shadcn `DropdownMenu` via existing UI patterns) with avatar circle showing first initial + first name label on `sm+` breakpoints.

**Rationale:** Matches user request; keeps wallet drawer pattern separate from account navigation.

**Alternatives:** Right drawer for account — rejected; inconsistent with lightweight menu expectation.

### 2. First name source

**Decision:** On `completeLoginFlow`, call Circle Users API (`GET /v1/w3s/users` or equivalent with `X-User-Token`) via new `getUser` action in `/api/circle`. Parse social identity name; extract **first token** as first name. POST to `/api/auth/session` (extended body) or dedicated `/api/profile` PATCH to upsert `profiles.display_name`.

On restore session (page load via `/api/biomarkers` profile payload), return `display_name` for menu label.

**Fallback chain:** `display_name` → first name from email local-part → `"Account"`.

**Rationale:** `display_name` column already exists; no new column needed for hackathon slice.

**Alternatives:** Client-only Google token decode — rejected; Circle mediates OAuth and server should be source of truth.

### 3. AI provider persistence

**Decision:** Migration `007_profile_settings.sql`:

```sql
alter table public.profiles
  add column if not exists ai_provider text not null default 'openai'
    check (ai_provider in ('openai', 'deepseek'));
```

`openai` = ChatGPT label in UI; `deepseek` = DeepSeek label.

**Rationale:** Single column on existing auth table avoids join table for two enum values.

**Alternatives:** JSON `settings` blob — rejected as premature abstraction.

### 4. Model resolution

**Decision:** Create `src/lib/ai-provider.ts`:

```typescript
export type AiProviderId = "openai" | "deepseek";

export function resolveLanguageModel(provider: AiProviderId) {
  if (provider === "deepseek") {
    return createOpenAI({
      apiKey: env.DEEPSEEK_API_KEY,
      baseURL: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    })("deepseek-chat"); // or deepseek-reasoner — document in env
  }
  return openai("gpt-4o-mini");
}

export async function resolveModelForProfile(profileId: string) {
  const profile = await getProfileById(profileId);
  return resolveLanguageModel(profile.ai_provider ?? "openai");
}
```

Wire into:
- `src/lib/extract-biomarkers.ts` (accept `profileId` or resolved model param)
- `src/app/api/reports/route.ts` POST handler
- Any other `generateText` / `generateObject` server paths

**Rationale:** One choke point; hackathon-safe; DeepSeek via OpenAI-compatible SDK already in stack.

**Alternatives:** Per-route provider env — rejected; user preference would not apply.

### 5. Settings API

**Decision:**

- `GET /api/profile` — returns `{ id, wallet_address, display_name, ai_provider, created_at }` for session profile.
- `PATCH /api/profile` — body `{ ai_provider?: "openai" | "deepseek" }`; validate enum; no other fields in this change.

Account page reads GET; AI settings page PATCH on save.

**Rationale:** Minimal surface; session-scoped via existing `getSessionProfileId()`.

### 6. UI copy mapping

| Internal `ai_provider` | UI label   |
|------------------------|------------|
| `openai`               | ChatGPT    |
| `deepseek`             | DeepSeek   |

AI Settings page: radio group or select with short description that processing uses the app's secure keys (no user API input).

### 7. Environment variables

**Decision:** Extend `src/lib/env.ts`:

- `DEEPSEEK_API_KEY` — required when `deepseek` is offered (same validation as `OPENAI_API_KEY`).
- `DEEPSEEK_BASE_URL` — optional, default `https://api.deepseek.com`.
- `DEEPSEEK_MODEL` — optional, default `deepseek-chat`.

**Rationale:** Server-only keys; user never sees or supplies them.

## Risks / Trade-offs

- **[Risk] Circle user API may not expose display name** → Mitigation: fallback to email local-part; spike `getUser` in Circle route during implementation.
- **[Risk] DeepSeek model quality differs from gpt-4o-mini for PDF/image extraction** → Mitigation: document in AI settings that ChatGPT is recommended default; smoke-test extraction with DeepSeek.
- **[Risk] Missing `DEEPSEEK_API_KEY` when user selects DeepSeek** → Mitigation: PATCH rejects if key unset; UI shows English error; server logs once.
- **[Risk] Top bar crowding on mobile** → Mitigation: show first initial only below `sm`, full first name on `sm+`.

## Migration Plan

1. Apply Supabase migration adding `ai_provider` column with default `openai`.
2. Deploy server with new env vars before enabling DeepSeek in production UI.
3. Existing profiles automatically use ChatGPT until user changes preference.
4. Rollback: hide AI settings link; column ignored; `resolveModelForProfile` defaults to openai.

## Open Questions

- Exact Circle endpoint field for Google given/family name — confirm during `getUser` spike (task 2.1).
- DeepSeek model id for vision/PDF (`deepseek-chat` vs dedicated vision model) — validate against Vercel AI SDK file parts in smoke test.
