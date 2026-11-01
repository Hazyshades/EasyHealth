# EH-160: Closed-beta onboarding

**Roadmap status:** In progress
**Build / environment:** Reviewed Sprint 8 build, authenticated browser, synthetic profiles, support channel from the beta invite
**Test run date:** PENDING
**Tester:** PENDING

## What this checklist covers

Invite allowlisting, revocation, current consent checks, synthetic examples, disclaimers, feedback, and the existing app-shell boundary.

## Before you start

- Prepare `EH160-INVITED`, `EH160-NOT-INVITED`, and `EH160-REVOKED` synthetic profiles.
- Confirm only the invited profile has `closed_beta_enabled`.
- Use current terms, health-data consent, and AI consent for the invited profile.
- Use only the support channel named in the beta invite.

## Interface checks

### EH160-UI-01: Invited profile sees the assistant

1. Sign in as `EH160-INVITED`.
2. Open **Ask about records** from desktop navigation.
3. Resize to a mobile viewport and open it from mobile navigation.

**Expected:** The page is reachable, states its personal-data scope and clinician boundary before the first request, and controls remain keyboard reachable on mobile.

**Result:** PENDING

### EH160-UI-02: Non-invited and revoked profiles are blocked

1. Sign in as `EH160-NOT-INVITED` and open the assistant route.
2. Repeat as `EH160-REVOKED`.
3. Open the existing Dashboard and Documents routes.

**Expected:** The assistant shows a generic closed-beta access state. Existing app routes remain available and are not blocked by the assistant gate.

**Result:** PENDING

### EH160-UI-03: Synthetic example does not resemble a health record

1. As `EH160-INVITED`, choose **View synthetic example**.
2. Review the answer and citation.
3. Check Profile, Timeline, Documents, and Health Profile for new rows or observations.

**Expected:** The example is clearly labelled synthetic, uses no real profile data, and creates no document, observation, assessment, or profile write.

**Result:** PENDING

### EH160-UI-04: Revoke access and feedback path

1. Revoke the invite in the beta administration path.
2. Refresh the assistant page.
3. Confirm the blocked state and support contact copy.
4. Restore access and submit controlled feedback on a synthetic answer.

**Expected:** Revocation takes effect on the next request. Feedback confirms receipt without collecting answer text by default.

**Result:** PENDING

## Developer evidence

- `pnpm test:eh160`
- Verify migration columns, access predicate, current consent check, synthetic response path, and no profile-data writes.
- Record that the existing app-shell redirect remains unchanged for non-beta users.

## Limitations

A real invite administration workflow and production support contact must be named before launch. Until then this checklist remains PENDING.
