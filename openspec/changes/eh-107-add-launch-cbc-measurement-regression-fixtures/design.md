## Context

EH-102 delivered the pre-launch Registry 2.0 catalog shape, sample-newest exact labels in `launch-fixtures.ts`, provisional `sample_*` definitions, and a partial set of reviewed CBC definitions (HGB/HCT/RBC/WBC/PLT/MCV, RDW-CV/SD, neu/lymf %/abs, retic %/abs, band %). EH-106 added a non-mutating 44-row candidate corpus where most CBC rows intentionally expect `partial` because specimen/context axes are incomplete. EH-101 already flagged differential abs/%, RDW variants, and reticulocytes as identity migration risks pointing at EH-107.

What is still missing is a **CBC-specific regression contract**: antipair guards, invalid units, and synthetic cases (reticulocytes, RDW-CV/SD) that the general corpus does not lock. EH-109 depends on EH-107; EH-113 later implements reviewed CBC rules against this green suite. This change is fixture/verification-only — no runtime product behavior change beyond making unsafe identity collapses fail CI.

Current anchors:

- `src/lib/biomarkers/launch-fixtures.ts` — 44-row sample labels
- `src/lib/biomarkers/measurement-resolution.ts` — reviewed + provisional definitions and resolver
- `registry/candidate-release/v1/corpus.json` — general launch gate (keep; do not replace)
- `scripts/verify-biomarkers-runner.ts` — sparse CBC smokes only
- No `openspec/changes/eh-107-*` or `QA/eh-107/` yet

## Goals / Non-Goals

**Goals:**

- Ship a versioned CBC fixture matrix that covers every EH-107 issue checklist family.
- Fail hard on wrong concrete `measurementDefinitionKey`, including when expected outcome is `partial`/`ambiguous`/`unmapped`.
- Keep evaluation pure (no observation/revision/score writers), deterministic, and CI-gated.
- Encode current safe catalog policy: many sample CBC rows remain non-concrete until EH-113; that is allowed and must stay stable.
- Leave a clear export contract for EH-109/EH-111/EH-113: suite stays green under later resolver changes only if identity rules hold.

**Non-Goals:**

- Do not promote mono/eos/bas, MCH/MCHC, MPV/PDW/PCT, segmented, ESR, or manual differentials to reviewed concrete definitions (EH-113 / catalog work).
- Do not implement multilingual or OCR-negative CBC matrices (EH-113).
- Do not build alias provenance records (EH-110) or partial/ambiguous UI (EH-112).
- Do not cover glucose specimen/timing variants (EH-114).
- Do not replace or loosen the EH-106 44-row candidate corpus gate.
- Do not change observation schema, acceptance writers, or assessment bindings.

## Decisions

### 1. Thin fixture suite, not catalog completion

EH-107 freezes **tests and expectations** against the resolver as it exists after EH-102/106. Expected outcomes may be `partial` for sample rows that only have provisional recognition. This is preferred over forcing concrete resolution now, which would fight the EH-106 corpus (`expected: partial` on most CBC rows) and steal EH-113 scope.

**Alternative considered:** Promote incomplete CBC definitions to reviewed so more fixtures `resolve`. Rejected — couples a regression ticket to clinical catalog review, inflates risk, and churns the launch corpus.

### 2. Separate CBC pack beside the 44-row corpus

Add a dedicated CBC fixture module and runner rather than overloading `registry/candidate-release/v1/corpus.json`.

- Sample-exact rows may be **derived or cross-checked** against launch fixtures / corpus labels for consistency.
- Identity antipairs, invalid units, and synthetic RDW/retic cases live only in the CBC pack.
- The EH-106 runner remains the general launchability gate; the CBC runner is the identity gate.

**Alternative considered:** Extend candidate corpus rows with deny-keys and synthetic CBC-only documents. Rejected — mixes release-approval policy with fine-grained unit antipairs and makes EH-106 reports noisier without clarifying ownership.

### 3. Fixture schema: expect classification + optional key + deny list

Each fixture record includes at least:

| Field | Role |
| --- | --- |
| `id` | Stable fixture id |
| `family` | Checklist family tag (`differential-abs-pct`, `rdw-variants`, `reticulocytes`, `red-cell-exact`, `platelets`, `diff-variants`, `units`) |
| `input` | `rawLabel`, `rawUnit`, optional specimen/section/method |
| `expected.classification` | `resolved` \| `partial` \| `ambiguous` \| `unmapped` |
| `expected.measurementDefinitionKey` | Required when classification is `resolved` |
| `expected.forbiddenKeys` | Concrete keys that must never appear (antipair / invalid unit) |
| `expected.allowConcreteKey` | Default `false` for non-resolved; `true` only when key is pinned |

Assertion precedence:

1. Coverage: every checklist family present.
2. Classification matches (or documented allowed set if a single primary is too brittle — prefer single primary).
3. If concrete key present: must equal expected key when pinned; must be absent when not allowed; must not intersect `forbiddenKeys`.

### 4. Pure runner patterned on EH-106 candidate corpus

Implement evaluation in a `scripts/lib/*` module that imports only resolver/catalog libraries — no Supabase, acceptance, or promotion paths. A thin `scripts/verify-*-runner.ts` asserts:

- all fixtures pass
- family coverage complete
- deterministic second run
- no writer imports (static source check, same spirit as EH-106)

Wire into `.github/workflows/measurement-registry.yml` and any local verify aggregate already used for registry gates.

### 5. Expectations snapshot current safe behavior, then lock it

Initial expected outcomes are captured from the current resolver **after** fixtures are authored, with manual review that:

- antipair `forbiddenKeys` are always present for identity pairs
- sample exact labels are never expected `unmapped`
- known reviewed paths that already resolve (e.g. neutrophils + `%` + sufficient context, band + whole_blood) may pin concrete keys
- bare labels and generic RDW stay non-concrete

If implementing the suite reveals a true identity bug (wrong concrete key today), fix the minimal resolver bug only when required for a coherent green baseline; do not expand into catalog promotion. Document any such fix in tasks/QA evidence.

### 6. QA checklist is developer-evidence first

`QA/eh-107/checklist.md` follows roadmap QA rules: no fake UI path. Manual section states the suite is not user-facing; developer-evidence lists runner command, fixture families, and CI job.

## Risks / Trade-offs

- **[Suite encodes today’s partial-heavy CBC policy and looks “weak”]** → Acceptable: identity antipairs and invalid units are the real value; EH-113 tightens resolve rates later without deleting guards.
- **[Resolver already collapses an antipair and suite is red on day one]** → Treat as in-scope minimal fix or explicit failing baseline only if product owner accepts; default is make identity hold with the smallest safe resolver correction, not broaden catalog.
- **[Duplication with launch-fixtures / corpus labels drifts]** → Prefer shared constants or generation from one label table for sample-exact rows; synthetic rows stay CBC-pack-only.
- **[CI only runs corpus and skips CBC suite]** → Explicit workflow + verify-runner task; release gate text requires CBC suite green, not corpus alone.
- **[EH-113 later changes expected classifications]** → Expected: update fixture expectations in the same change that promotes definitions; forbiddenKeys remain unless clinical equivalence is explicitly reviewed.
- **[Over-fitting aliases in fixtures hides EH-110 work]** → Fixtures assert outcomes only; they do not introduce a new alias provenance model.

## Migration Plan

1. Author CBC fixture pack and shared types beside existing biomarker fixtures.
2. Implement pure evaluator + verify runner; capture and review expected outcomes.
3. Wire CI / local verify; ensure EH-106 corpus still passes unchanged.
4. Add `QA/eh-107/checklist.md` with developer evidence.
5. No database migration, feature flag, or runtime deploy sequence — ship with ordinary app/CI merge.
6. Rollback: revert fixture/runner/CI files; no data rollback required.

## Open Questions

- None blocking. If a current resolver antipair failure is found during apply, prefer a minimal identity fix over weakening the fixture; escalate only if the fix requires new reviewed catalog definitions (then split to EH-113).
