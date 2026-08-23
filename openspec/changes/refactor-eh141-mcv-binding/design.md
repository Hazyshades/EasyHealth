# refactor-eh141-mcv-binding — Design

## Context

EH-141 (`af7ef08`) made MCV a reviewed core Blood readiness/contribution input by adding a conditional spread inside the CBC tuple-mapping loop at `src/lib/biomarkers/measurement-resolution.ts:344`:

```ts
...(key === "mcv" ? { binding: assessment("blood", "mcv", "core", { coversConfidence: true, readinessGroup: "mcv", contributionGroup: "mcv" }) } : {})
```

The tuple loop's purpose is to share one binding-less definition shape across the provisional CBC indices (`mch`, `mchc`, `mpv`, `pdw`, `plateletcrit`). Every bound marker in this file is a standalone `reviewed({ ..., binding: assessment(...) })` call — including MCV's direct siblings `hemoglobin_whole_blood`, `hematocrit_whole_blood` (lines 339–340), `wbc_whole_blood`, and `platelets_whole_blood`. The thermo-nuclear review flagged the conditional as a special case bolted into an already overloaded line (1393 chars, nested key-remap ternaries).

The same review found `scripts/verify-eh141-score-required-groups.ts` tests context-only inputs only in isolation (`[usableMarker(contextOnly)]` → `incomplete`). The issue #41 acceptance criterion — "optional measurements cannot accidentally satisfy readiness" — is strongest when a context-only marker is swapped into an otherwise complete set in place of a required group. That composition is unpinned.

## Goals / Non-Goals

**Goals:**

- Delete the `key === "mcv"` conditional; restore the tuple loop to binding-less provisional indices only.
- Give MCV the same first-class definition shape as its bound siblings.
- Pin the context-only-cannot-replace-a-required-group composition in the contract runner.
- Remove the inline MCH policy object and its `as MeasurementUnitPolicy` cast via a named `MCH_POLICY` const.
- Zero behavior change: identical catalog output, identical manifest digest, identical readiness results.

**Non-Goals:**

- Decomposing `measurement-resolution.ts` (1625 lines) into per-system modules — separate effort.
- Any change to readiness evaluation in `src/lib/health-systems.ts` (untouched since EH-125).
- Any edit to generated files. The AGENTS.md registry-documentation-sync and QA-checklist completion gates still apply and are discharged by verification: generated docs/manifest output is proven byte-identical (`git diff -- docs registry` empty, `check:biomarker-docs` green), and the QA checklist records the strengthened contract coverage.

## Decisions

1. **Standalone `reviewed()` entry for MCV, not a bindings map keyed by tuple index.**
   A `Record<"mcv", RuntimeBinding>` consulted inside the loop would replace one conditional with a lookup indirection and keep MCV in a loop that no longer describes it. A standalone entry matches the file's dominant pattern, makes the binding visible at the definition site, and shrinks line 344. Equivalence is mechanical: the map currently produces `key: "mcv_whole_blood"`, `analyteKey: "mcv"`, `displayName: "Mean corpuscular volume"`, `specimen: "whole_blood"`, `property: "mean_cell_volume"`, `scale: "quantitative"`, `timing: "point_in_time"`, `method: "automated"`, `valueKind: "numeric"`, `aliases: cbcAliases(["mcv"], { fixtureValues: ["Mean corpuscular volume (MCV)"] })`, `unitPolicy: VOLUME_POLICY`, plus the binding — the standalone call states exactly these fields.
   *Alternative considered:* keep the conditional and only add tests — rejected; the review's presumptive blocker is the special case itself.

2. **Composition test loops over `CONTEXT_ONLY_INPUTS` per system, swapping into a complete set.**
   For each system with declared context-only inputs, take the complete marker set, replace one required group's marker with the context-only marker, and assert `incomplete` + `computeSystemStateScore(...) === null`. This directly pins "cannot replace", complementing the existing isolation test ("cannot unlock alone").
   *Alternative considered:* asserting only that readiness ignores non-core roles — rejected; that tests the engine's mechanism, not the policy contract.

3. **Named `MCH_POLICY` const instead of inline object + cast.**
   Every other unit policy in the file is a named const; the inline object is the sole `as MeasurementUnitPolicy` cast. Naming it deletes the cast and keeps the tuple row readable. Placed next to the other policy consts.

## Risks / Trade-offs

- **Manifest digest drift** — if the extraction is not field-identical, `documentation-baseline.json` and generated docs change. Mitigation: `pnpm test:biomarkers` and `pnpm check:biomarker-docs` must pass unchanged; `git diff -- docs registry` must be empty after the refactor.
- **Alias key stability** — alias keys are derived as `${record.key}:${alias.source}:${index + 1}`; the standalone entry must use the same single-element `cbcAliases(["mcv"], ...)` seed so keys stay `mcv_whole_blood:registry:1` / `:fixture:N`. Covered by `pnpm test:biomarkers`.
- **Contract runner false confidence** — the new composition test must use a context-only marker that actually resolves to a non-core role (e.g., `total_cholesterol`, `rbc`), otherwise it passes vacuously. The existing `CONTEXT_ONLY_INPUTS` table already lists role-resolved keys; reuse it as the single source.
