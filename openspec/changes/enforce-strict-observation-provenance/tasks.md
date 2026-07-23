## 1. Field and writer inventory

- [ ] 1.1 Inventory every observation INSERT/UPDATE/RPC path and classify document-lab, instrumental, and non-document-lab source policy.
- [ ] 1.2 Encode the exact common immutable field set and source-specific lineage sets in one maintained database/application contract.
- [ ] 1.3 Confirm EH-104/EH-106 mutable projection fields remain outside the provenance trigger and retain same-source enforcement.
- [ ] 1.4 Inventory direct service-role table grants/callers that could currently set the purge GUC or update provenance.

## 2. Populated preflight and controlled backfill

- [ ] 2.1 Add retained-data preflight grouped by source type, protected field, authoritative evidence availability, owner, and writer/version.
- [ ] 2.2 Define an explicit reviewed backfill manifest with observation ids, expected old-row digests/nulls, exact target values, and evidence source.
- [ ] 2.3 Implement the migration-only backfill procedure with fixed search path, no runtime grants, exact expected-state checks, auditable results, and post-use revoke/drop.
- [ ] 2.4 Add populated fixtures for approved, repeated, non-null, cross-owner/source, stale-digest, unmanifested, and partially invalid backfill batches.

## 3. Strict enforcement and purge security

- [ ] 3.1 Replace every `OLD IS NOT NULL` provenance predicate with strict `NEW IS DISTINCT FROM OLD` enforcement for common and source-specific fields.
- [ ] 3.2 Add source-type INSERT guards for mandatory laboratory writer provenance, instrumental source lineage, and non-document rows that cannot later acquire document lineage.
- [ ] 3.3 Replace `easyhealth.purge_lineage` authority with private transaction/backend/operation/row/transition-scoped authorization owned by a no-login role.
- [ ] 3.4 Restrict the interim controlled purge to exact locked document rows and paired lineage clearing; deny arbitrary fields and direct authorization access.
- [ ] 3.5 Mark the private purge path temporary and hand its removal gate to durable deletion final-purge cutover without making this change depend on that later implementation.

## 4. Writer alignment

- [ ] 4.1 Update laboratory writers to provide final mandatory provenance at INSERT and fail rather than enrich later.
- [ ] 4.2 Confirm instrumental preparation supplies immutable source-measure evidence and never attaches laboratory lineage/catalog projection.
- [ ] 4.3 Confirm non-document laboratory writers intentionally set or omit provenance at INSERT and never convert the row to document-derived.
- [ ] 4.4 Remove any runtime provenance backfill/enrichment call path and keep equal idempotent retries valid.

## 5. Database and security verification

- [ ] 5.1 Add pgTAP for `NULL → value`, `value → NULL`, changed value, equal value, and both-null retry across every protected field group.
- [ ] 5.2 Add source-policy tests for mandatory document-lab provenance, instrumental lineage, non-document null policy, kind/owner/source mutation, and valid EH-106 projection changes.
- [ ] 5.3 Add role/grant negatives proving PUBLIC, anon, authenticated, and ordinary service-role code cannot invoke backfill, forge GUC/private authorization, or mutate protected fields.
- [ ] 5.4 Add controlled-purge tests for exact allowed transition, wrong document/row/digest/backend/transaction, extra field mutation, repeated use, and partial failure rollback.
- [ ] 5.5 Restore a real observation-provenance database integration runner and wire populated migration plus pgTAP suites into CI.

## 6. Rollout and evidence

- [ ] 6.1 Run target retained-data preflight; abort or apply only the reviewed controlled backfill before enabling strict trigger enforcement.
- [ ] 6.2 Deploy writer-compatible code and strict migration in the documented order, then smoke laboratory, instrumental, non-document, equal-retry, and rejected-mutation paths.
- [ ] 6.3 Update `QA/eh-103/checklist.md` with separate tester-facing behavior and developer database/security evidence without marking unavailable checks passed.
- [ ] 6.4 Record the temporary purge authorization, durable-deletion removal owner, and still-pending no-runtime-bypass Sprint 1 gate without claiming later removal evidence.
