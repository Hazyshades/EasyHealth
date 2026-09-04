## 1. Knowledge Base public contract

- [x] 1.1 Restore `measurementEducationArticleSchema` in the value exports of `src/lib/knowledge-base/index.ts` without changing its implementation in `types.ts`.
- [x] 1.2 Extend `scripts/verify-eh134-knowledge-base.ts` to import the schema through the public Knowledge Base barrel and validate the existing synthetic published measurement article.

## 2. Health navigation compatibility

- [x] 2.1 Restore the `/app/biomarkers` branch in `healthRouteLabel` while retaining the `/app/knowledge` and nested Knowledge route branch.
- [x] 2.2 Extend `scripts/verify-eh131-health-navigation.ts` to assert Biomarkers labeling with navigation context and Knowledge labeling for a nested CBC route.

## 3. Verification and delivery evidence

- [x] 3.1 Run `pnpm test:eh131`, `pnpm test:eh133`, `pnpm test:eh134`, and `pnpm test:eh135` and confirm the compatibility repair does not regress any related change.
- [x] 3.2 Run typecheck, production build, and strict OpenSpec validation for this repair change.
- [x] 3.3 Update `QA/eh-135/checklist.md` with the repair evidence while preserving the existing authenticated-UI blocker, and record the verified repair scope in issue #35 without closing the issue before merge.
