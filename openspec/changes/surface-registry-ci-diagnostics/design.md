## Context

The registry verifier emits useful diagnostics but GitHub's job summary does not retain them on failure.

## Goals / Non-Goals

**Goals:** show bounded failure output in the job summary and propagate the original failure.

**Non-Goals:** change verifier order, ignore failures, or expose secrets.

## Decisions

Wrap only the `verify:registry` command in Bash with `set -o pipefail`, tee output to a temporary file, append its last 200 lines within a fenced summary block on failure, and exit with the captured status.

## Risks / Trade-offs

The summary is intentionally bounded; full output remains in Actions logs.