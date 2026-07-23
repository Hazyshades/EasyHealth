## 1. Transition schema

- [ ] 1.1 Add the temporary old-name composite FK alias with the same columns, target key, MATCH FULL, delete behavior, and deferrability as `observations_normalization_revision_same_source_fk`.
- [ ] 1.2 Add preflight that identifies whether migration 034 is applied, whether each constraint exists, and whether any relationship definition diverges.
- [ ] 1.3 Add schema-cache reload and live old-hint recovery checks for the 034-applied path.
- [ ] 1.4 Add the controlled pause/apply-034-plus-bridge/cache-reload procedure for the 034-pending path.

## 2. Runtime consumers

- [ ] 2.1 Update document observations to the same-source FK hint.
- [ ] 2.2 Update Biomarkers and Health Profile to the same-source FK hint.
- [ ] 2.3 Update Reports and structured context to the same-source FK hint.
- [ ] 2.4 Add a scoped static check that bans the old hint in active runtime code while allowing migrations/history.

## 3. PostgREST verification

- [ ] 3.1 Build a real migrated PostgREST fixture with owner, document, laboratory observation, extracted source, and active same-source revision.
- [ ] 3.2 Prove all five read paths on the dual-constraint transition schema and assert unchanged projections.
- [ ] 3.3 Prove the 034-pending-to-transition and 034-applied-to-transition paths, including schema-cache reload failure/success.
- [ ] 3.4 Wire the live PostgREST suite and static hint check into CI before deployment.

## 4. Rollout and follow-up ownership

- [ ] 4.1 Deploy the bridge before new code according to the target-state matrix and record environment/cache/read evidence.
- [ ] 4.2 Inventory every application instance and target environment and record the owner and acceptance gates for a separate alias-removal change.
- [ ] 4.3 Confirm this change contains no executable alias-drop migration and that removal will be proposed only after complete cutover evidence.
- [ ] 4.4 Run target-environment smoke for all five consumers and record the FK hotfix release evidence.
