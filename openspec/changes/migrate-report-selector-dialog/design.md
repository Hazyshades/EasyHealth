## Context

Report creation uses an inline overlay for document selection.

## Goals / Non-Goals

**Goals:** provide portal, focus management, scroll locking, and Escape dismissal.

**Non-Goals:** alter document selection or abnormal-only behavior.

## Decisions

Use Radix Dialog behind a minimal shared UI wrapper. Control its open state with the existing state setter so Cancel, Escape, and outside dismissal behave consistently.

## Risks / Trade-offs

Dialog markup changes while the existing selection state remains unchanged.