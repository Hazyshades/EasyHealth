## Context

The repository has many verification scripts. Shell `&&` already stops on failure, but a script that runs a verifier followed by a search with `;`, `||`, or a pipeline can report success without proving the verifier passed.

## Goals / Non-Goals

**Goals:** reject masking command shapes before CI runs; retain independently named verifier and structural-check steps.

**Non-Goals:** replace every existing `&&` sequence or duplicate test execution.

## Decisions

Add a static verifier that reads package scripts and workflow `run` fields, identifies a test/verifier before `rg`, `grep`, or `findstr` joined by masking operators, and fails with its source location. CI runs it before suite-coverage checks.

## Risks / Trade-offs

The guard deliberately permits `&&`, which is fail-fast, and may need extension if new shell constructs are adopted.