# Candidate Release Reset and Rollback Notes

## Reset

Before a pre-launch evaluation, use a disposable environment and rebuild only
the fixture inputs from this candidate-release directory. The corpus command is
read-only: it must not be used to create observations, revisions, trends,
readiness records, scores, or manual decisions. Re-run the candidate command
after a fixture or Registry 2.0 definition changes so the input hash, report,
and approvals are refreshed together.

## Rollback

Do not restore Registry v1 at runtime. For a rejected pre-launch candidate,
retain its manifest/report as evidence, reset the disposable fixture
environment, correct the Registry 2.0 definition or fixture, issue a new
candidate input hash, and obtain new hash-bound approvals. After deployment,
use a reviewed forward Registry 2.0 release rather than a legacy dual-read or
feature-flag rollback path.

## Multilingual candidate (EN + RU + ES)

The multilingual slice moved the candidate input hash. The corpus grew from 53
English rows to 72 rows: the English CBC and serology rows that were previously
filed under `cbc-ru-north` and `specialty-ru-central` now belong to
`cbc-en-north` and `specialty-en-central`, and genuine Cyrillic and Spanish rows
were added alongside two deliberate unknown-marker rows.

Consequences for a release run:

- Every hash-bound approval in `approvals.json` must be re-issued against the
  new candidate input hash before the candidate is launchable again. The
  technical gate (`--technical-check`) passes on its own; `--check` stays red
  until a human re-approves.
- Recognition, alias and unit coverage are scored over rows the corpus expects
  to be recognized. The two unknown-marker rows must stay `unmapped`, which is
  asserted by `expectedClassificationRate` and `falseConcreteResolutions`.
- Per-language gates in `policy.languageThresholds` are evaluated separately for
  `en`, `ru` and `es`. A passing aggregate cannot make a failing language
  launchable.
- To reset, restore this directory from the previous candidate tag and re-run
  `report:registry-v2-candidate-corpus`; no patient data is involved.
