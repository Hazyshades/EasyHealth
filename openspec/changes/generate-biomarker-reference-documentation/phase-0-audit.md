# Candidate-work reconciliation

| Candidate surface | Disposition | Reason |
| --- | --- | --- |
| `scripts/generate-biomarker-docs.ts` | Revise | The renderer has useful stable sorting and cell escaping, but hard-codes counts, reads the approval-bound runner, owns an issue file, and writes no managed README section. |
| `scripts/verify-biomarker-docs.ts` | Revise | It provides basic determinism, catalog, alias, and stale-output checks, but uses hard-coded counts/full runner and lacks baseline, README, Health Profile, persistence, and Wiki contract coverage. |
| `scripts/export-biomarker-wiki.ts` | Replace | It writes by default, permits an implicit output directory, and embeds stale counts, approval state, and issue `#122`. |
| `docs/03-modules/biomarkers.md` | Revise/regenerate | Candidate generated output has useful narrative, but reports approval state and conflates extraction with resolution. |
| `docs/05-data/biomarker-catalog.md` | Revise/regenerate | Candidate generated output is not baseline-bound and lacks executable consumer-eligibility claims. |
| `docs/05-data/biomarker-aliases.md` | Revise/regenerate | Candidate generated output is retained only as a renderer comparison artifact; final output must derive from one validated alias model. |
| `docs/05-data/biomarker-corpus-evidence.md` | Revise/regenerate | Candidate output exposes approval state and launchability, violating the technical-evidence boundary. |
| `docs/05-data/biomarker-catalog-issue.md` | Remove | A generated issue body is not a canonical documentation output. The replacement is stdout-only. |
| `docs/README.md` | Revise | Existing links and command guidance are retained through a single generated marker section; the current issue link is removed. |
| `package.json` | Revise | Candidate command names/options do not meet the final side-effect contract. |
| `.github/workflows/measurement-registry.yml` | Revise | Candidate documentation checks must be placed after typecheck and before Registry cutover/broader checks. |
| `scripts/lib/registry-v2-candidate-corpus.ts` | Revise | Introduce approval-independent technical evaluation while preserving the current approval-bound release runner. |
| `scripts/registry-v2-candidate-corpus.ts` | Revise | `--technical-check` currently invokes the approval-bound runner. |

All listed surfaces were inspected before modification. Existing unrelated worktree changes remain out of scope.