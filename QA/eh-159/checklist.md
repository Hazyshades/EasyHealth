# EH-159: Assistant operations and quotas

**Roadmap status:** In progress
**Build / environment:** Reviewed Sprint 8 build, local or staging Supabase, service-role worker and invited synthetic profiles
**Test run date:** PENDING
**Tester:** PENDING

## What this checklist covers

Atomic request limits, token/latency/retrieval telemetry, cost reservations, privacy-safe logs, controlled feedback, and provider failure handling.

## Before you start

- Use `EH159-PROFILE-A` with a documented test quota policy.
- Use synthetic questions only.
- Do not inspect or retain prompt text, answer text, source excerpts, raw API keys, or raw provider errors in operational evidence.

## Interface checks

### EH159-UI-01: Reach the request limit

1. Submit requests until the configured daily test limit is reached.
2. Submit one additional request.

**Expected:** The additional request is rejected with a clear limit state and reset information. Concurrent attempts do not bypass the limit.

**Result:** PENDING

### EH159-UI-02: Submit controlled feedback

1. Submit an answer.
2. Choose **Not yet**.
3. Select one controlled category and send feedback.
4. Repeat with an unsupported category through a direct API probe.

**Expected:** The UI confirms accepted feedback without exposing telemetry. The direct unsupported category is rejected. Feedback is tied to the authenticated request and profile.

**Result:** PENDING

### EH159-UI-03: Provider failure state

1. Use a test provider configuration that safely returns an unavailable response.
2. Submit a general-education question.

**Expected:** The user sees a generic temporary-unavailable message. Provider credentials, raw SDK errors, question text, and answer text are absent from retained operational events.

**Result:** PENDING

## Developer evidence

- `pnpm test:eh159`
- `pnpm test:eh159-db`
- Confirm atomic quota lock, request event status transitions, request ID linkage, source counts, latency/token fields, bounded cost reservation, and AI error-code constraints.
- Confirm the completed request event retains the reserved estimated cost when the provider invocation summary has no usable cost estimate.
- Attach a privacy scan of retained logs and a concurrency run separately from UI evidence.

## Limitations

Production cost rates, alerts, and on-call response remain PENDING until configured and rehearsed in the release environment.
