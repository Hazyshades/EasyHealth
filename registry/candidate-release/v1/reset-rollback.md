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
