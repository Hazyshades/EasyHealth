## 1. Registry definition refactor

- [x] 1.1 Extract `mcv_whole_blood` into a standalone `reviewed({ ..., binding: assessment("blood", "mcv", "core", { coversConfidence: true, readinessGroup: "mcv", contributionGroup: "mcv" }) })` entry beside the other bound Blood markers in `src/lib/biomarkers/measurement-resolution.ts`
- [x] 1.2 Remove the `["mcv", ...]` tuple and the `key === "mcv"` conditional spread from the CBC tuple-mapping loop
- [x] 1.3 Replace the inline MCH unit-policy object and its `as MeasurementUnitPolicy` cast with a named `MCH_POLICY` const beside the other policy consts

## 2. Contract runner strengthening

- [x] 2.1 Add the composition regression to `scripts/verify-eh141-score-required-groups.ts`: for each system with `CONTEXT_ONLY_INPUTS`, swap a context-only marker into the complete set in place of each required group and assert `incomplete` plus a `null` state score
- [x] 2.2 Remove the stray double blank line in the contract runner

## 3. Verification

- [x] 3.1 Run `pnpm test:eh141`, `pnpm test:biomarkers`, `pnpm test:health-profile-lab-input`, `pnpm typecheck`, and `pnpm check:biomarker-docs`; all must pass with zero changes to generated docs, `documentation-baseline.json`, or the manifest digest (`git diff -- docs registry` empty)
- [x] 3.2 Run `pnpm exec openspec validate refactor-eh141-mcv-binding --strict`
