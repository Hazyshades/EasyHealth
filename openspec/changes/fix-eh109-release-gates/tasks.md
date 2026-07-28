## 1. Branch and release evidence

- [x] 1.1 Integrate current `master` into the PR branch and confirm migrations 036–037 and the two failing CI jobs are present locally.
- [x] 1.2 Generate the resolver v6 candidate report and record the exact candidate-input hash, all threshold results, classification mismatches, false concrete resolutions, and processing errors.
- [x] 1.3 Renew false-concrete, score-affecting, and release-gate approval records for the verified candidate-input hash with explicit review notes.
- [x] 1.4 Run candidate corpus test/check commands and confirm the committed candidate release is launchable and deterministic.

## 2. Documents database repair

- [x] 2.1 Add the next append-only Supabase migration that replaces `claim_document_processing_job(uuid)` using the current master function as its source.
- [x] 2.2 Qualify processing-attempt column references while preserving the function signature, grants, fixed search path, lock order, ownership checks, state transition, attempt creation, and returned fields.
- [x] 2.3 Add or extend database regression coverage for a successful claim and the existing-active-attempt no-claim path.
- [ ] 2.4 Run the EH-105 database fixture against a reset local Supabase stack when available.
- [x] 2.5 Replace `prepare_instrumental_publication` in migration 038 with table aliases for every query column that collides with a `RETURNS TABLE` output name.
- [x] 2.6 Replace `finalize_instrumental_publication` in migration 038 with a qualified `write_generation` increment and correct mismatched pgTAP dollar quoting in the EH-105 and PR2 fixtures.

## 3. Release verification and merge

- [x] 3.1 Run `pnpm verify:registry`, `pnpm typecheck`, `openspec validate fix-eh109-release-gates --type change --strict`, and all focused resolver/document tests.
- [x] 3.2 Commit and push the repair artifacts and implementation to PR #94 without staging unrelated local files.
- [x] 3.2a Commit and push the publication-preparation ambiguity repair and updated change artifacts.
- [x] 3.2b Commit and push the publication-finalization ambiguity repair and updated change artifacts.
- [ ] 3.3 Confirm every required GitHub check is green, then merge PR #94 into `master`.
- [ ] 3.4 Record the merge commit and final CI evidence on issues #9 and #10 and ensure their final state is closed.