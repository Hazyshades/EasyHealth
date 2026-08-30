## Context

`StatusChip` provides textual labels but no visual cue beyond hue.

## Goals / Non-Goals

**Goals:** add compact, decorative iconography without changing the spoken label.

**Non-Goals:** redefine status semantics or add live-region announcements.

## Decisions

Map success to Check, warning/error to AlertCircle, info to Info, and default/neutral to no icon. Render icons with `aria-hidden` and `shrink-0` beside no-wrap text.

## Risks / Trade-offs

The added icon consumes horizontal space; the compact 12px size and no-wrap layout preserve pill scanning.