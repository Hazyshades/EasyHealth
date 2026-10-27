# EH-158: Assistant evidence and citations

**Roadmap status:** In progress
**Build / environment:** Reviewed Sprint 8 build, invited synthetic beta profile with safe fixture documents
**Test run date:** PENDING
**Tester:** PENDING

## What this checklist covers

Server-owned source projection, claim-to-source validation, citation links, coverage metadata, limitation states, and safe API errors.

## Before you start

- Use `EH158-PROFILE-A` with one eligible structured source and one eligible narrative page.
- Use `EH158-PROFILE-B` to test ownership boundaries.
- Keep the test documents synthetic and de-identified.

## Interface checks

### EH158-UI-01: Verify a cited personal answer

1. Ask a question whose answer is present in the fixture source.
2. Submit the question.
3. Review the answer's **Sources** section.
4. Open the citation link.

**Expected:** The citation is visible, points to an owned document route, and the answer does not expose opaque internal source identifiers as user-facing prose.

**Result:** PENDING

### EH158-UI-02: Verify unsupported-claim limitation

1. Ask for a personal fact absent from all fixture sources.
2. Submit the question.

**Expected:** The answer states that available evidence is insufficient. It does not fill the gap with a likely value. The limitation is visible.

**Result:** PENDING

### EH158-UI-03: Verify general education boundary

1. Ask: `What does a reference range mean?`.
2. Review the answer and source section.

**Expected:** The answer is general education, does not make a personal claim, and shows the educational disclaimer.

**Result:** PENDING

## Developer evidence

- `pnpm test:eh158`
- Verify `assistant_requestSchema`, model response validation, source ownership, unknown source IDs, cross-profile sources, and safe status codes.
- The evidence fixture treats a health-record claim written with personal language as personal even when the model labels it `general`, and rejects it without an authorized source.
- Confirm API responses use `Cache-Control: no-store` and do not return raw provider errors.

## Limitations

The local fixture proves the validator contract. It does not prove production model behavior or clinical review acceptance.
