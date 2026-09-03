# EH-139: Publication and review checks

**Roadmap status:** In progress (implementation complete; functional UI checks executed with temporary synthetic fixtures; clinical article approval remains EH-136)
**Build / environment:** Windows 11, Node 22, Next.js 15.5.24, Chromium; local Supabase unavailable because Docker Desktop Linux Engine is not running
**Test run date:** `2026-09-03`
**Tester:** Automated test run

## What this checklist covers

The public Knowledge Base must expose only content that has passed review, has
source evidence, and is inside the review-freshness window. Published articles
show their reviewer, last reviewed date, every source link, educational body,
and medical disclaimer; deprecated slugs redirect only to a fresh published
replacement. The current branch intentionally ships an empty article catalog
until clinically reviewed content is supplied by EH-136.

## Before you start

- [x] No test account was needed because the Knowledge Base routes are public.
- [x] Only synthetic fixtures were used; no patient or production content was used.
- [x] The application was run from the branch under test.
- [x] Temporary fixtures were removed and the production registry was restored after each run.

## Test data

| ID                    | Test document or setup                                                                                                 | Purpose                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `EH139-EMPTY-01`      | The branch's intentionally empty `content/knowledge-base/articles.ts` registry                                         | Fail-closed public index check          |
| `EH139-PUBLISHED-01`  | Temporary synthetic article with reviewer metadata, past review timestamp, and two HTTPS sources                       | Published metadata and source rendering |
| `EH139-DRAFT-01`      | A synthetic article with identical content but lifecycle state `draft`                                                 | Unreviewed visibility rejection         |
| `EH139-STALE-01`      | A synthetic published article whose review timestamp is more than 365 days before the test time                        | Stale-content rejection                 |
| `EH139-DEPRECATED-01` | A synthetic deprecated slug with a fresh published replacement plus a second deprecated slug with no valid replacement | Safe redirect and index fallback        |

## Interface checks

### EH139-UI-01: Empty catalog stays private by default

**Precondition:** The application is running with `EH139-EMPTY-01`; no reviewed article fixture has been added.

1. Open `/knowledge-base` in a private browser window.
2. Inspect the page heading and article list.
3. Try `/knowledge-base/any-slug` for a slug that is not in the registry.

**Expected result:** The index shows the Knowledge Base empty state and no article cards. The unknown article route returns the not-found response. No draft, review, stale, or unregistered content is presented as guidance.

**Result:** `Pass` (2026-09-03: Chromium verified `/knowledge-base` returned 200 with the empty state and zero article cards; `/knowledge-base/any-slug` returned HTTP 404. The production registry was restored afterward.)
**Notes / evidence link:** Next dev server smoke: empty index and framework 404.

### EH139-UI-02: Published article exposes review and source evidence

**Precondition:** `EH139-PUBLISHED-01` is present in the branch registry, the application has been rebuilt, and the article is reachable at its canonical slug.

1. Open `/knowledge-base/<published-slug>`.
2. Read the article header and body.
3. Locate the **Sources** section and open each source link in a new tab.
4. Locate the medical disclaimer at the bottom of the article.

**Expected result:** The page shows the article title, summary, reviewer identity, last reviewed date, version, Markdown body, every configured source link, and the medical disclaimer. Source links use HTTPS and open as external links. No assessment result, personal health data, or diagnostic conclusion is shown.

**Result:** `Pass` (2026-09-03: with a temporary synthetic fixture, Chromium displayed title, summary, reviewer, localized review date, version, Markdown body, medical disclaimer, and two HTTPS source links with external targets. External source uptime was not tested.)
**Notes / evidence link:** `eh139-ui-published` Chromium run; fixture removed after test.

### EH139-UI-03: Unreviewed and stale articles are not public

**Precondition:** A test build contains `EH139-DRAFT-01` and `EH139-STALE-01` only as synthetic registry entries; the test time and 365-day policy are recorded.

1. Open `/knowledge-base/<draft-slug>`.
2. Open `/knowledge-base/<stale-slug>`.
3. Return to `/knowledge-base`.

**Expected result:** Both article routes return the not-found response, and neither article appears in the index. The application does not silently display content missing reviewer evidence or outside the freshness window.

**Result:** `Pass` (2026-09-03: draft and stale routes returned HTTP 404 without exposing either body; the index returned 200 with zero article cards. The stale fixture also caused the publication check and build preflight to exit 1.)
**Notes / evidence link:** `eh139-ui-draft-stale` Chromium/HTTP run; fixture removed after test.

### EH139-UI-04: Deprecated pages redirect safely

**Precondition:** A test build contains `EH139-DEPRECATED-01`, with one deprecated article pointing to a fresh published replacement and one deprecated article without a valid public replacement.

1. Open the deprecated slug that has the fresh replacement.
2. Confirm the browser follows the redirect.
3. Open the deprecated slug without a valid replacement.

**Expected result:** The first slug permanently redirects to the replacement's canonical Knowledge Base URL. The second slug permanently redirects to `/knowledge-base`. No deprecated article body is rendered and no redirect points to draft, review, stale, unknown, or external content.

**Result:** `Pass` (2026-09-03: Chromium followed the valid deprecated slug to `/knowledge-base/synthetic-current` and the fallback slug to `/knowledge-base`; direct HTTP checks observed 308 responses with those exact internal `Location` values, and no deprecated body was rendered.)
**Notes / evidence link:** `eh139-ui-deprecated` Chromium/HTTP run; fixture removed after test.

## Developer evidence required

- [x] `pnpm test:knowledge-base` passed on 2026-09-03: deterministic lifecycle, review/source evidence, stale boundary, deprecation target, redirect, invalid timestamp/registry, and rendered metadata checks.
- [x] `pnpm check:knowledge-base` passed with a valid temporary synthetic registry: 3 articles, 1 published, 0 stale.
- [x] `pnpm check:knowledge-base` passed after restoring the production registry: 0 articles, 0 published, 0 stale, no validation errors.
- [x] `pnpm check:knowledge-base -- --report --as-of 2026-09-03T00:00:00.000Z` passed and emitted the deterministic JSON stale-content report.
- [x] `pnpm check:knowledge-base` with `EH139-STALE-01` exited 1 and reported `synthetic-stale` as 368 days old against the 365-day maximum.
- [x] `pnpm build` with a valid temporary synthetic registry passed; the prebuild publication gate ran before Next.js production compilation.
- [x] `pnpm build` with `EH139-STALE-01` exited 1 in prebuild before Next.js compilation.
- [x] `pnpm exec tsc --noEmit` passed on 2026-09-03.
- [x] `pnpm check:ci-suite-coverage-contract` and `pnpm check:ci-suite-coverage` passed on 2026-09-03; the EH-139 verifier remains workflow-reachable (90 covered, 0 orphaned).
- [x] `openspec validate eh-139-publication-review-checks --strict` and the targeted Prettier check passed on 2026-09-03.
- [x] Database applicability assessed: EH-139 is file-backed and has no migration, table, RPC, RLS, or persistence contract; no unrelated database test was substituted for an EH-139 contract.
- [ ] `supabase status` and `supabase db start` were attempted, but local execution is blocked by the missing Docker Desktop Linux Engine; run only against a disposable local/CI stack when Docker is available.

## Out of scope or not manually testable yet

- Clinical approval of article wording and source quality; EH-136 supplies the reviewed article set. The functional UI checks above use temporary synthetic fixtures and do not constitute clinical sign-off.
- Editing article content through an admin UI; the registry is version-controlled and no editor interface exists in this change.
- Verifying external source uptime or clinical correctness; HTTPS shape, target behavior, and source presence were validated locally, while owners must review source quality.
- No EH-139 database contract exists because the change does not persist or read database state. Local Supabase startup was attempted but remains blocked by Docker Desktop; CI/database evidence is required only if future scope adds persistence.
