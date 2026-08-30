## Context

`docs/README.md` is an index, but multiple linked folders are absent while current operations and data pages exist.

## Goals / Non-Goals

**Goals:** preserve valid links, remove invalid links, and prevent recurrence.

**Non-Goals:** reconstruct historical documentation content.

## Decisions

Derive the maintained quick-link list from targets present under `docs/`; add a Node verifier that resolves relative Markdown links in the index and fails for missing tracked targets.

## Risks / Trade-offs

Pruning historical links reduces discoverability of deleted documentation but avoids publishing false navigation.