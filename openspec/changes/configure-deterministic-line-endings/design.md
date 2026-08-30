## Context

The repository already carries a narrow PDF binary attribute but has no broad text line-ending policy.

## Goals / Non-Goals

**Goals:** normalize text to LF and protect common binary data.

**Non-Goals:** rewrite historical working-tree files in this change.

## Decisions

Use `* text=auto eol=lf`; mark PDF, PNG, JPG/JPEG, GIF, WebP, ICO, and common font files binary. Retain the fixture-specific PDF entry for clarity.

## Risks / Trade-offs

A checkout may normalize text on its next refresh; this is the intended deterministic policy.