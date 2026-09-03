## Why

EasyHealth already has reviewed Registry 2.0 panel membership and a Health Timeline, but users have no calm, source-backed explanation of what a complete blood count is or why one laboratory report may contain a different set of measurements than another. EH-135 adds the first reusable panel-education surface now so the CBC experience can link general education to a user's own results without changing normalization, scoring, or assessment behavior.

## What Changes

- Add a versioned, read-only panel-article record using the canonical EH-133 Knowledge Base contract, with review status, locale, content version, review metadata, source references, and related Registry 2.0 measurement-definition keys.
- Add a reusable panel article template that renders a panel purpose, an explicit composition caveat, named subgroups, measurement member cards, optional/related labels, sources, and the medical disclaimer.
- Add an authenticated Knowledge entry point and `/app/knowledge/panels/cbc` page. The page keeps educational content separate from a clearly labeled “Your CBC results” section, reads profile-owned observations through the existing read API, and links each available result to its existing Biomarkers/source navigation.
- Add the first English CBC panel article content in an explicit preview state while EH-133's clinical-review workflow remains open. The page distinguishes red-cell, white-cell, and platelet measurements and labels common differential or supporting measurements without implying that every laboratory reports every member.
- Do not add database tables, migrations, write APIs, resolver rules, panel memberships, score inputs, reference-range interpretation, diagnosis, or test-order recommendations.

## Capabilities

### New Capabilities

- `panel-knowledge-article`: Versioned, reviewed panel education content and a safe reusable article presentation with a CBC implementation.

### Modified Capabilities

<!-- No existing OpenSpec requirement changes; this is a new read-only knowledge surface. -->

## Impact

- **Target domains:** health-profile (Registry-linked measurement presentation) and reports (educational content surface); the authenticated app shell gains a Knowledge entry point.
- **Affected code:** a new `src/lib/knowledge-base/` content module, reusable panel article components, Knowledge routes, navigation metadata, and a focused verification script/package command.
- **Existing boundaries:** panel membership is consumed from the reviewed Registry 2.0 catalog; user results come from `GET /api/biomarkers`; source links reuse the existing `/app/biomarkers` and document navigation contracts.
- **Dependencies:** EH-125 panel definitions and the canonical EH-133 article contract are available. This change adds the richer panel presentation fields and keeps the CBC record in review until named clinical evidence exists.
- **Operational scope:** no persistence or database regression suite is applicable. Registry catalog files are consumed but not changed; generated Registry documentation should remain unchanged and its required checks must be recorded during completion.
