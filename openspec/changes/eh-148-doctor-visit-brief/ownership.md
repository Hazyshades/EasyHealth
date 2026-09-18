# Sprint 7 file ownership

This matrix is part of the EH-148 design gate. Ownership means the named change is the only branch allowed to edit the file during parallel implementation. Other changes may consume the interface read-only. A required cross-cutting edit is handed back to the owner instead of being applied in two branches.

## Ownership matrix

| Change | Write-owned paths | Read-only consumers and handoff |
|---|---|---|
| EH-148 Doctor Visit Brief | `src/lib/report-contract.ts`; `src/lib/report-evidence.ts`; `src/lib/report-read.ts`; `src/lib/report-safety-policy.ts`; `src/lib/reports.ts`; `src/lib/report-prompts.ts`; `src/lib/generate-doctor-summary.ts`; `src/lib/documents/structured-context.ts`; `src/app/api/reports/route.ts`; `src/app/api/reports/[id]/route.ts`; `src/app/app/reports/[id]/page.tsx`; `src/components/report-body.tsx`; report persistence migration and `public.create_validated_report` RPC; `QA/eh-148/**` | Contract, source projection, safety policy, read resolver, persistence transition/RPC, and report-detail integration are the foundation. EH-150 supplies validator calls to EH-148; EH-153 supplies a leaf export component to the EH-148 page seam. |
| EH-149 Biomarker Dynamics | `src/lib/biomarker-comparison.ts`; `src/lib/biomarker-dynamics.ts`; `src/lib/biomarker-dynamics-server.ts`; `src/app/api/biomarkers/route.ts`; `src/app/api/biomarkers/dynamics/route.ts`; `src/app/app/biomarkers/**`; biomarker dynamics components; `QA/eh-149/**` | EH-153 consumes the frozen dynamics DTO and does not query observations or edit biomarker modules. EH-148 calls the server adapter with exact report scope and never edits EH-149 implementation files. |
| EH-150 Citation Validator | `src/lib/report-citation-validator.ts`; citation fixtures and verifier scripts; `QA/eh-150/**` | EH-148 owns `src/app/api/reports/route.ts` integration. EH-151/EH-153 consume the validator result and do not reimplement its rules. |
| EH-151 Scoped Shares | share-link, `share_replacement_operations`, `share_rate_limit_buckets`, and `report_share_access_events` migrations/repository/retention; service-only replacement, cleanup, and rate-limit RPCs; `src/lib/share-links/**` including `public-response-policy.ts` and `rate-limit.ts`; `src/lib/env.ts`; `.env.example`; owner creation endpoint; public `/share/**` page/API and its export-actions integration slot; `worker/src/index.ts` and `worker/src/env.ts` cleanup integration; public response policy; `QA/eh-151/**` | EH-152 consumes the owner-scoped event read projection and management/replacement repository seam. EH-153 consumes `applyPublicShareResponsePolicy` for public exports and supplies the export-actions component and contract; EH-151 remains the public share-page writer and wires that component. EH-154 inspects the public boundary, deployed limiter settings, and cleanup evidence but does not create a second verifier. |
| EH-152 Share Management | owner share list/revoke/replacement API; share-management page/components; owner-scoped access-history projection; `QA/eh-152/**` | EH-151 owns token verification, share persistence, durable event persistence/retention, and the service-only replacement writer. EH-154 consumes minimized event/header evidence. |
| EH-153 Export Package | `src/lib/report-export/**`; `src/components/report-export-actions.tsx`; export route adapters and public-export response-policy call site; PDF/font asset; `QA/eh-153/**` | EH-148 wires the component into the authenticated report detail page. EH-151 wires the same component through its public share-page slot. EH-151 owns share authorization and the policy helper; EH-153 calls that helper before shared PDF/CSV/JSON responses; EH-154 verifies policy and leakage behavior. |
| EH-154 Privacy Gate | threat-model and release evidence in this OpenSpec change; `scripts/verify-eh154-share-privacy.ts`; `QA/eh-154/**`; incident runbook evidence | No production authorization path is owned here. Findings are fixed by the owning feature change and the gate is rerun. |

## Shared-file rules

- `src/lib/report-contract.ts` has one writer: EH-148. All consumers pin to its exported version and do not add local aliases.
- `src/app/api/reports/route.ts` has one writer: EH-148. EH-150 provides validator API/fixtures; EH-148 applies the integration patch.
- `src/app/app/reports/[id]/page.tsx` has one writer: EH-148. EH-153 integrates through `report-export-actions.tsx`, not by editing the page in parallel.
- `src/app/share/[token]/page.tsx` has one writer: EH-151. EH-153 supplies the leaf export component and its props contract; EH-151 applies the public-page integration patch.
- `src/lib/biomarker-comparison.ts` has one writer: EH-149. Export reads the dynamics DTO only.
- `package.json`, CI verification policy, and migration filenames are serialized integration points. The active owner edits them; the next owner consumes the resulting commit and never guesses a migration number.
- QA files are owned by their matching change. A checklist may reference another change's evidence but must not mark that evidence complete until the owning branch supplies it.

## Safe sequencing

1. Freeze EH-148 contract and source-scope decisions.
2. Run EH-149 and EH-150 in parallel only after the contract interface is frozen; they have disjoint write sets.
3. Start EH-151 after EH-150's publishability result is available.
4. Start EH-152 after EH-151's management seam is frozen.
5. Run EH-153 after EH-149 and EH-150 interfaces are available; its leaf component avoids the EH-148 page conflict.
6. Run EH-154 after EH-151, EH-152, and EH-153 evidence exists. Any high/critical finding returns to the owning change and blocks release.
