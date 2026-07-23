# Measurement Registry Rollout — SUPERSEDED

**Status:** Superseded by EH-108 on 2026-07-23.

This file previously described a shadow / dual-runtime measurement-resolution
rollout (`off` / `shadow` / `promote`) and feature-flag rollback toward
Registry v1. That guidance is **inactive** and must not be followed.

## Current canonical docs

- Decision record: [`adr/0001-registry-v2-hard-cutover.md`](adr/0001-registry-v2-hard-cutover.md)
- Procedural cutover: [`launch-cutover-checklist.md`](launch-cutover-checklist.md)
- Registry index: [`README.md`](README.md)
- Candidate-release evidence: [`candidate-release/v1/README.md`](candidate-release/v1/README.md)

## Forbidden

- Do not enable Registry v1 runtime adapters or dual-read paths.
- Do not use `EASYHEALTH_MEASUREMENT_RESOLUTION_MODE=off|shadow|promote` as a
  launch or rollback mechanism.
- Do not restore Registry v1 to recover from a Registry 2.0 defect.

Rollback is forward-only within Registry 2.0. See the launch cutover checklist.
