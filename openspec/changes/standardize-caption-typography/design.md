## Context

Compact metadata currently uses undocumented literal sizes.

## Goals / Non-Goals

**Goals:** provide one named 11px compact-type role.

**Non-Goals:** change body or label typography.

## Decisions

Expose `--text-caption: 0.6875rem` through Tailwind v4 and replace each 10px/11px literal with `text-caption`.

## Risks / Trade-offs

Captions remain smaller than normal body text; their existing dark foregrounds must retain AA contrast.