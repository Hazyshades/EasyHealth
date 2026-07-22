## Why

Signed-in users have no visible identity or settings entry point in the app header. Wallet balance and sign-out are the only top-bar controls, while account context (Google name, preferences) is invisible. A user menu anchored on the Google first name improves orientation and provides a single path to account info and AI provider preference without expanding into BYOK or custom API keys.

## What Changes

- Add a **user menu button** in `TopBar` between the wallet balance trigger and **Sign out**, labeled with the user's **Google first name** (fallback when unavailable).
- Add a dropdown menu with links to **Account**, **Settings**, and **AI Settings** (English UI strings).
- Add `/app/account` — wallet address, profile metadata, sign-in context.
- Add `/app/settings` — general settings shell (minimal placeholder acceptable for hackathon slice).
- Add `/app/settings/ai` — choose **ChatGPT (OpenAI)** or **DeepSeek** as the preferred provider for server-side LLM calls.
- Persist per-profile AI provider preference in Supabase; default to ChatGPT when unset.
- Capture and store Google **first name** on login in `profiles.display_name` (or dedicated column) for the menu label.
- Introduce shared server helper `resolveModelForProfile(profileId)` used by biomarker extraction, report generation, and any remaining LLM routes.
- Add server env `DEEPSEEK_API_KEY` (and optional `DEEPSEEK_BASE_URL` defaulting to DeepSeek OpenAI-compatible endpoint).

## Capabilities

### New Capabilities

- `user-menu`: Header user menu trigger (first name label), dropdown navigation, placement in top bar.
- `account-settings`: Account and general Settings pages reachable from the menu.
- `ai-provider-preference`: Per-profile ChatGPT vs DeepSeek selection, persistence, and routing for all server LLM calls.

### Modified Capabilities

- `app-shell`: Top bar layout gains user menu between wallet trigger and sign out.

## Impact

- **Database**: Migration adding `ai_provider` (or `profile_settings` row) and ensuring `display_name` stores first name from Google/Circle identity.
- **Auth / Circle**: Extend login/session flow to fetch and persist user first name from Circle user profile API.
- **API**: New `GET/PATCH /api/profile/settings` (or split routes) for account display and AI preference.
- **Lib**: New `src/lib/ai-provider.ts` (or similar) centralizing model resolution; update `extract-biomarkers.ts`, `POST /api/reports`, and other LLM entry points.
- **Frontend**: New `UserMenu` component; pages under `/app/account`, `/app/settings`, `/app/settings/ai`; possible shadcn `DropdownMenu` addition.
- **Env**: `DEEPSEEK_API_KEY` required when DeepSeek is selectable; existing `OPENAI_API_KEY` unchanged.
- **Unchanged**: x402 pricing and flow; no user-supplied API keys; no custom provider URLs in UI; Health Profile remains at `/app/profile` in sidebar only.
