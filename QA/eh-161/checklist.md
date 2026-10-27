# EH-161: Closed-beta release readiness

**Roadmap status:** In progress
**Build / environment:** Reviewed Sprint 8 build, local or staging Supabase, worker, backup/restore environment, and release owner
**Test run date:** PENDING
**Tester:** PENDING

## What this checklist covers

Durable deletion, backup and restore, rollback, incident readiness, monitoring, known limitations, and the explicit go/no-go record.

## Before you start

- Use synthetic profiles and documents only.
- Record the reviewed build identifier and migration range.
- Have the release owner, backup identifier, restore environment, and incident support channel available.
- Do not mark production readiness from local typecheck or a source review alone.

## Interface checks

### EH161-UI-01: Document deletion removes assistant evidence

1. Create a synthetic answer with structured and narrative citations.
2. Start the supported document deletion flow.
3. Wait for the deletion operation to complete.
4. Ask the same question and open the Documents route.

**Expected:** The deleted document, page citation, and pending re-index work are unavailable. The existing app shows the documented deletion state without exposing stale content.

**Result:** PENDING

### EH161-UI-02: Release checklist and known limitations

1. Open `docs/06-ai/closed-beta-release-checklist.md` with the release owner.
2. Review each production gate.
3. Confirm any PENDING gate has an owner, evidence requirement, and explicit no-go consequence.

**Expected:** Backup/restore, rollback, incident, monitoring, provider, quota, deletion, and support gates are visible. No unavailable production evidence is described as complete.

**Result:** PENDING

## Developer evidence

- `pnpm test:eh161`
- `pnpm test:eh161-db`
- `pnpm typecheck`
- Confirm the durable deletion trigger, document/profile cascades, queue cleanup, and known limitation record.
- Run a production-like backup restore and rollback rehearsal separately; retain identifiers and timestamps in the release record.
- Run focused safety, retrieval, citation, quota, onboarding, and deletion checks before any go/no-go decision.

## Go/no-go

**Current status:** `PENDING production evidence`

A release owner must not enable the beta until the checklist records green or explicitly approved waivers for every required gate.
