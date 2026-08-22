# EasyHealth

A personal health record platform: users upload their medical documents, the system extracts laboratory and clinical data into verified observations, and synthesizes them into a health profile.

## Language

### Documents & ingestion

**Document**:
A medical file (PDF or image) uploaded by a user: lab results, imaging study, consultation note, discharge summary, prescription, or referral.
_Avoid_: record, file.

**Document type**:
The user-selected category of a document that drives the extraction pipeline.
_Avoid_: kind.

**Detected document type**:
The content class assigned by automatic classification after upload; compared against the document type to flag mismatches.
_Avoid_: document type (when meaning the classified one).

**Processing status**:
User-visible lifecycle of a document: `processing`, `needs_review`, `ready`, or `failed`.
_Avoid_: bare "status" (a legacy `documents.status` field also exists).

**Worker**:
The background Node.js process that claims processing jobs and runs the extraction pipeline outside Next.js.
_Avoid_: pipeline (the pipeline is what the worker executes).

**Extraction**:
Production of structured candidates from document content into staging rows by the worker's LLM/OCR steps.
_Avoid_: parsing.

**Extracted biomarker**:
A staging row holding one candidate laboratory result awaiting user review. Becomes an observation only through acceptance.
_Avoid_: observation (before acceptance).

**Acceptance**:
The user action promoting an extracted biomarker into an observation.
_Avoid_: confirmation (reserved for review confirmation), import.

**Review confirmation**:
The guarded action completing review of a needs-review document when no actionable extracted biomarkers remain.
_Avoid_: acceptance.

**Reprocess**:
Re-running extraction for an existing document, optionally with a corrected document type, without a new upload.

**Page preview**:
A rendered WebP image of one document page served through a signed URL.

**Signed URL**:
Short-lived storage URL handed to the client for originals, page previews, and thumbnails. Raw storage paths never reach the client.

### Identity & resolution

**Observation**:
An accepted laboratory value owned by a profile; the only row feeding trends, scores, and reports. Identity axes prevent distinct real-world results from overwriting each other.
_Avoid_: biomarker, measurement (as nouns for the stored row).

**Canonical key**:
The single normalized identifier for a biomarker concept after alias resolution.
_Avoid_: raw key, lab key.

**Alias**:
A known laboratory label, abbreviation, or OCR variant mapped to a canonical key or measurement definition; carries source and match policy. An OCR variant is not a reviewed alias.
_Avoid_: synonym list.

**Analyte**:
A Registry substance being measured (for example glucose); parent of measurement definitions.

**Measurement definition**:
A reviewed registry entry declaring the identity axes of exactly one measurable thing: specimen, value kind, unit policy, timing, method, modifier, maturity, and assessment behavior.
_Avoid_: biomarker definition.

**Identity axes**:
The properties distinguishing one measurement from another: specimen, property/value kind, scale/unit family, timing, method, modifier.
_Avoid_: attributes.

**Registry**:
The versioned catalog of analytes, measurement definitions, aliases, units, and assessment bindings. "Registry v1" is the frozen legacy baseline; "Registry 2.0" is the runtime authority after cutover.

**Maturity**:
Lifecycle of a definition: `provisional`, `reviewed`, or `retired`. Only reviewed active definitions authorize concrete resolution and assessment.

**Resolver**:
The deterministic evidence-based engine selecting a resolution outcome from authorized candidates.
_Avoid_: mapper, matching.

**Resolution outcome**:
Exactly one of `resolved`, `ambiguous`, `partial`, or `unmapped` returned by the resolver. Only `resolved` carries a concrete measurement definition key.

**Partial result**:
A recognized-but-incomplete outcome: analyte or family recognized, one concrete reviewed measurement not justified. Preserved as a first-class safe state, never guessed.
_Avoid_: unknown, failed match.

**Hard conflict**:
An observed axis mismatch (unit family, value kind, specimen, timing, method) making a candidate non-selectable regardless of score.
_Avoid_: low score.

**Mapping confidence**:
Resolver-derived support for the leading candidate (0 to 0.99). Independent of extraction confidence.
_Avoid_: certainty.

**Extraction confidence**:
Raw model-reported metadata about text extraction quality. Never alters mapping outcomes.

**Decision trace**:
Persisted versioned evidence of one normalization decision: candidates, per-axis evidence, scores, selection.
_Avoid_: log.

**Normalization revision**:
Append-only record of a mapping decision with actor, evidence, and supersession links. Prior decisions are never deleted or overwritten.

**Assessment binding**:
Versioned reviewed declaration linking measurement definitions to an assessment input/group.
_Avoid_: compatibility key.

### Health profile & synthesis

**Profile**:
The person-level row keyed one-to-one to the auth user; holds display name, consents, and preferences.
_Avoid_: account.

**Auth user**:
The Supabase identity. Its id equals the profile id.

**Health Profile**:
The product surface synthesizing observations into current-state body-system views and marker details.
_Avoid_: profile (when meaning this page).

**Body system**:
One of the fixed catalog-driven systems: cardiovascular, metabolic, thyroid, liver, kidney, blood, nutrients, inflammation, general.

**Score role**:
Catalog classification of a marker: `core`, `extended`, or `display`.

**Coverage flag**:
Whether a marker counts toward system data-confidence coverage.

**Holistic synthesis**:
Service-role generation of the current-state summary from accepted observations.
_Avoid_: AI summary.

### Accounts & access

**Onboarding gates**:
Ordered post-auth requirements: the profile-name gate first, then the consent gate.
_Avoid_: wizard steps (the getting-started wizard is separate).

**Getting-started wizard**:
The dismissible post-onboarding tour shown after gates pass.

**App shell hot path**:
The read-only session-resolution contract for `/app/*` navigation: one session read per request, zero profile writes.
_Avoid_: auth flow.

**Session-gated action**:
A free core action (upload, review, reports) authorized by a valid Supabase session alone.
