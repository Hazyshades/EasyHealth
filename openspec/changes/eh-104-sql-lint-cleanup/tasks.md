## 1. Migration Boundary

- [x] 1.1 Confirm the applied migration head and choose the next available serialized migration filename with the integration owner; inspect target drift before editing.
- [x] 1.2 Add one forward maintenance migration that replaces `eh104_resolution_verification_preflight`, `consume_storage_upload_ticket`, `complete_storage_write_intent`, and `persist_profile_health_synthesis` while preserving signatures, return shapes, `SECURITY DEFINER`, fixed `search_path`, grants, error codes, and locking behavior.
- [x] 1.3 Remove the retired `measurement_resolution_shadow_events` compatibility query without recreating the table, view, or replacement relation.
- [x] 1.4 Qualify upload-ticket `intent_id`/`ticket_hash` references and synthesis `profile_id`/`input_hash` references with table aliases; keep all RPC callers unchanged.

## 2. Database Evidence

- [x] 2.1 Add or update focused pgTAP evidence that invokes the resolver preflight with the retired shadow relation absent, preserves live finding output, and verifies the affected function signatures and service-only grants.
- [x] 2.2 Exercise a valid upload-ticket consume/complete transition and an invalid intent-or-hash attempt, proving the corrected lookup remains atomic and does not mutate the wrong ticket.
- [x] 2.3 Exercise a valid Health Profile synthesis write and the stale-source-generation rejection path, proving the corrected `(profile_id, input_hash)` lookup preserves source fencing and idempotency.

## 3. Local Schema Verification

- [x] 3.1 Reset and migrate a disposable local Supabase database through the complete current migration chain.
- [x] 3.2 Run `supabase db lint --local` and confirm the three EH-104 relation/ambiguity findings are absent without suppressions.
- [x] 3.3 Run `pnpm test:eh104-db` and `pnpm test:eh104-durable-deletion-db`; record any environment blocker rather than treating an unrun command as passed.
- [x] 3.4 Review the resulting schema for the absence of `public.measurement_resolution_shadow_events` and confirm existing application RPC call sites still resolve the original overloads.

## 4. Registry Documentation Synchronization

- [x] 4.1 Confirm the resolver-preflight correction changes no biomarker definitions, aliases, units, corpus evidence, assessment bindings, or Health Profile projection semantics.
- [x] 4.2 Run `pnpm generate:biomarker-docs`, `pnpm check:biomarker-docs`, and `pnpm test:biomarker-docs`; review generated changes and keep canonical docs unchanged when the confirmation is clean.
- [x] 4.3 Run `pnpm render:biomarker-wiki` and the explicit local staging export, review the output, and probe `https://github.com/Hazyshades/EasyHealth.wiki.git` for publication status.
- [x] 4.4 Create or update exactly one `[Registry Docs]` tracking issue with canonical-doc links, Wiki `PUBLISHED`/`PENDING`/`BLOCKED` status, commands, verification evidence, and remaining handoff gaps.

## 5. Roadmap Handoff

- [x] 5.1 Update `QA/eh-104/checklist.md` with the SQL lint, migration, and pgTAP developer evidence; leave unavailable UI, worker, browser, and trusted-ingress checks explicitly untested or blocked.
- [x] 5.2 Record that Mistral installation, browser environment variables, trusted ingress, EH-151 share behavior, and EH-154 release evidence are separate follow-up gates and are not closed by this change.
