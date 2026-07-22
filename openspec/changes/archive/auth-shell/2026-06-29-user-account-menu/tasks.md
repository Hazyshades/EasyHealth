## 1. Database and environment

- [x] 1.1 Add migration `007_profile_ai_provider.sql` — `profiles.ai_provider` text not null default `openai` with check constraint (`openai`, `deepseek`)
- [x] 1.2 Extend `src/lib/env.ts` with `DEEPSEEK_API_KEY`, optional `DEEPSEEK_BASE_URL`, optional `DEEPSEEK_MODEL`
- [x] 1.3 Document new env vars in `.env.example` (if present) or README snippet

## 2. Circle identity — first name

- [x] 2.1 Spike Circle `getUser` API in `/api/circle` — confirm field for Google given name
- [x] 2.2 On login (`completeLoginFlow`), fetch user identity and extract first name token
- [x] 2.3 Extend `/api/auth/session` POST (or profile upsert) to persist `display_name` first name on `profiles`
- [x] 2.4 Ensure session restore (`GET /api/biomarkers` or new profile GET) returns `display_name` to client

## 3. AI provider resolution

- [x] 3.1 Create `src/lib/ai-provider.ts` with `resolveLanguageModel` and `resolveModelForProfile`
- [x] 3.2 Update `src/lib/extract-biomarkers.ts` to accept profile-scoped model from resolver
- [x] 3.3 Update `POST /api/reports` (and any other server LLM routes) to use `resolveModelForProfile`
- [x] 3.4 Update upload/OCR API route to pass `profileId` into extraction with resolved model

## 4. Profile API

- [x] 4.1 Implement `GET /api/profile` — session profile with `display_name`, `ai_provider`, wallet metadata
- [x] 4.2 Implement `PATCH /api/profile` — validate `ai_provider` enum; reject DeepSeek when `DEEPSEEK_API_KEY` missing

## 5. User menu UI

- [x] 5.1 Add shadcn `DropdownMenu` (or equivalent) under `src/components/ui/`
- [x] 5.2 Create `UserMenu` component — first name label, initial avatar, dropdown links
- [x] 5.3 Integrate `UserMenu` into `top-bar.tsx` between `WalletAccountTrigger` and Sign out
- [x] 5.4 Extend `WalletProvider` or fetch profile on mount for `displayName` with fallback chain

## 6. Account and settings pages

- [x] 6.1 Create `/app/account/page.tsx` — wallet address, first name, created date
- [x] 6.2 Create `/app/settings/page.tsx` — minimal shell with link to AI Settings
- [x] 6.3 Create `/app/settings/ai/page.tsx` — ChatGPT vs DeepSeek radio/select, save via PATCH

## 7. Verification

- [x] 7.1 Manual smoke: sign in → first name appears on menu button
- [x] 7.2 Manual smoke: menu links navigate to Account, Settings, AI Settings
- [x] 7.3 Manual smoke: set DeepSeek → upload lab → extraction uses DeepSeek (verify via logs or response metadata if available)
- [x] 7.4 Manual smoke: set ChatGPT → generate report → succeeds with OpenAI
- [x] 7.5 Manual smoke: unpaid upload still returns 402
- [x] 7.6 Manual smoke: mobile top bar shows initial-only label without layout break
