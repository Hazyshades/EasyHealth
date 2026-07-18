## Context

The repository contains obsolete Circle, Arc, x402, Gateway, and hackathon material in repository-local agent skills, the skill lock file, active documentation, and legacy scratch documentation. Runtime implementation and environment configuration are intentionally retained. Archived OpenSpec artifacts are historical records and must remain unchanged.

## Goals / Non-Goals

**Goals:**
- Remove obsolete repository-local Circle and hackathon metadata from active maintenance surfaces.
- Keep runtime code, dependency declarations, package lockfiles, migrations, and `.env*` files byte-for-byte unchanged.
- Preserve `openspec/changes/archive/**` unchanged.

**Non-Goals:**
- Removing Circle, Arc, x402, Gateway, or wallet behavior from application code.
- Replacing the removed payment or wallet architecture.
- Editing environment files or revoking credentials.
- Rewriting historical archived OpenSpec material.

## Decisions

### 1. Delete Circle-specific skills rather than retain disabled placeholders

Remove the repository-installed Circle skills and their `skills-lock.json` entries. Disabled placeholders would continue to advertise obsolete capabilities and create maintenance ambiguity.

### 2. Remove active documentation entries and legacy scratch material

Delete documents that are exclusively Circle/x402/hackathon material. For mixed product documents, remove only obsolete sections while retaining unrelated product documentation. This avoids deleting current PHR documentation merely because it shares a file with a retired integration.

### 3. Preserve runtime and archive boundaries

No files under `src/`, package manifests or lockfiles, migrations, `.env*`, or `openspec/changes/archive/**` are modified. This makes the cleanup reversible at the metadata boundary and prevents behavior changes.

## Risks / Trade-offs

- Active documentation will no longer explain retained Circle runtime code; this is intentional during the transition.
- Broad textual cleanup can miss variants or remove unrelated prose; verification must search active, non-archived metadata after removal.
- Legacy scratch files may contain sensitive-looking material. This change removes the file but does not revoke any external credential.