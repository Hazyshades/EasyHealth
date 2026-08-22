# Document and timeline deepening review

An evidence-backed architecture review of the recently changed Document, Medical Event, and Health Profile paths. It records deepening opportunities only; it does not choose an implementation or propose a concrete interface.

## Context

EH-126 introduced the precision-safe Medical Event model. EH-127 added the Health Profile timeline projection while that model was unavailable on its branch. EH-130 introduced non-destructive duplicate resolution by marking a Document with `archived_at`. EH-131 connected Health Profile evidence navigation.

Recent changes cluster around Document reads, the timeline, and Health Profile projections. The review uses the domain terms from `CONTEXT.md`: Document, extracted biomarker, acceptance, observation, Medical Event, profile, and Health Profile.

## Goal

Increase locality, leverage, and testability in hot paths by turning shallow modules into deep modules. The interface must become the test surface rather than helper imports or source-text assertions.

## Scope

- `src/app/api/timeline/route.ts`, `src/lib/timeline.ts`, and the Health Profile timeline page.
- Document archive admission across lists, Reports, Health Profile, Biomarkers, structured context, and the Medical Event timeline.
- The Documents server-first-paint and client loading lifecycle.
- The Document review read path.

Out of scope: Registry behavior, extraction behavior, concrete interfaces, implementation, and unrelated ADRs. No relevant ADR files were present in this checkout.

## Finding 1: make active Document admission deep

**Recommendation:** Strong.

### Evidence

- EH-130 writes `documents.archived_at` for an archived duplicate without deleting the Document or its source evidence: `supabase/migrations/070_eh130_duplicate_document_detection.sql`.
- Document list, Reports, Health Profile, Biomarkers, and structured context independently exclude archived Documents.
- `public.medical_event_timeline` joins `public.documents` without an `archived_at` condition: `supabase/migrations/069_eh126_normalized_medical_events.sql`.
- The normalized timeline route reads that view without a compensating active-Document check: `src/app/api/timeline/route.ts`.

### Problem

The active Document rule leaks across projection modules. Every projection owns a local check except the Medical Event timeline.

### Root cause

Archive admission was added after the Medical Event view. The rule has no authoritative deep module, so each projection re-implements it at its seam.

### Deepening direction

Concentrate active Document admission in one deep module. Every projection, including the Medical Event timeline, should depend on that seam.

### Benefits

- **Locality:** one archive rule.
- **Leverage:** projections change together.
- **Interface:** one test surface for archive exclusion.
- **Tests:** one profile-scoped archive scenario proves every consumer path.

### Deletion test

Deleting individual archive guards leaks archived Documents. Deleting a deep admission module would concentrate the lifecycle rule, which is the desired depth.

### Risk

**[INFERENCE]** An archived Document can appear in the normalized timeline and then have its source rejected by `assertDocumentOwner`. The source proves the missing view condition; this specific row was not instantiated in a disposable database during the review.

## Finding 2: collapse competing Health Profile timeline contracts

**Recommendation:** Strong.

### Evidence

- `src/app/api/timeline/route.ts` dispatches to `getHealthTimelinePage` when `type`, `from`, `to`, `page`, or `pageSize` is present. It otherwise dispatches to `getNormalizedTimeline`.
- `src/app/app/timeline/page.tsx` always requests the first path.
- The first path reads Documents plus five typed extracted-row sets and projects them through `src/lib/timeline.ts`.
- The normalized path reads `medical_event_timeline`, date-role rows, and linked observations while retaining source date precision.
- EH-126 and EH-127 each describe a different current contract in their design records.

### Problem

Incidental query keys give one route interface two incompatible meanings: a Document projection with day-or-unknown dates, or a precision-aware Medical Event projection.

### Root cause

EH-126 and EH-127 converged after separate delivery paths, leaving one route adapter to select implementation ownership from query vocabulary.

### Deepening direction

Make the Health Profile timeline one deep module. Keep Medical Event chronology and typed evidence as internal implementation, and remove query-key selection as ownership.

### Benefits

- **Locality:** chronology rules do not fork.
- **Leverage:** one timeline interface supports the Health Profile.
- **Depth:** typed evidence and precision live behind one seam.
- **Tests:** parity scenarios replace separate source-text assertions.

### Deletion test

Neither current branch is dead: each serves a distinct use. A unified deep module would concentrate competing timeline rules behind one seam.

## Finding 3: deepen Document hub loading

**Recommendation:** Strong.

### Evidence

- `src/app/app/documents/page.tsx` turns the server list result into four props: initial Documents, initial tab, initial-fetch reuse, and initial-load failure.
- `src/app/app/documents/documents-hub.tsx` combines those props with tab state, a consumed ref, hard and soft loads, polling, retry, and error rendering.
- `src/lib/documents/hub-initial-load.ts` exports two Boolean predicates with one production caller.
- `scripts/verify-app-navigation-hot-path.ts` imports the predicates and reads `DocumentsHub` source to assert lifecycle behavior.
- `src/lib/documents/list.ts` is a real seam: both the page and tab route adapter use it.

### Problem

The server-to-client handoff is a Boolean/ref protocol split between a 545-line Document hub module and a 26-line helper module. Its interface does not expose the lifecycle that verification needs.

### Root cause

Server first paint was added to remove an initial client fetch, then failure recovery and processing polling evolved around the existing stateful hub.

### Deepening direction

Concentrate first paint, hard failure, tab change, soft refresh, polling, and retry transitions in one deep Document hub loading module. Preserve the list module because its two adapters make that seam real.

### Benefits

- **Locality:** lifecycle transitions live together.
- **Leverage:** one lifecycle suite protects first paint and refresh.
- **Interface:** behavior becomes directly testable.
- **Tests:** browser or state-transition scenarios replace source-text checks.

### Deletion test

Deleting the two predicates only moves their conditions into the hub, so the current seam is shallow. A deep lifecycle module would concentrate the transition implementation.

## Finding 4: concentrate Document review reads

**Recommendation:** Worth exploring.

### Evidence

- `src/components/documents/document-viewer.tsx` is 1,982 lines and owns metadata, pages, signed URLs, extracted-biomarker review, acceptance, corrections, verification, duplicate resolution, processing recovery, history, and evidence navigation.
- `src/app/api/documents/[id]/route.ts` is a 405-line owner-scoped bootstrap that reads pages, extracted biomarkers, typed rows, worker heartbeat, normalization revisions, batch eligibility, and duplicate candidates.
- The client reads that bootstrap and then issues a separate authoritative observation read.

### Problem

The Document review module has useful outer depth, but its owner-scoped read seam leaks a broad raw projection into the UI module and splits freshness across requests.

### Root cause

New Document review capabilities were added incrementally to a bootstrap projection and client state graph that already coordinated review behavior.

### Deepening direction

Deepen only the read side: concentrate bootstrap projection, freshness, and page/file enrichment behind the Document review module. Leave acceptance, correction, and review confirmation in their existing domain modules.

### Benefits

- **Locality:** one Document review read path.
- **Leverage:** a thin route adapter.
- **Depth:** raw projections stay behind the seam.
- **Tests:** the read interface replaces source-text checks.

### Deletion test

Deleting bootstrap or observation reads breaks Document review. A deep read module concentrates their implementation without splitting the existing deep UI module only for file size.

## Recommended exploration order

1. **Active Document admission.** It is a focused correctness seam introduced by recent archival behavior and has the highest leverage across projections.
2. **Health Profile timeline contracts.** It follows once archive admission is explicit, because the normalized timeline must own the same lifecycle semantics.
3. **Document hub loading.** It is a smaller lifecycle deepening with repeated recent failure pressure.
4. **Document review reads.** Explore only after measuring bootstrap payloads and refresh behavior; avoid a file-size-driven split.

## Risks

- Converging timeline behavior must preserve Medical Event source-date precision and must not invent a calendar day.
- Active Document admission must preserve archived source evidence while removing it from product projections.
- The Document hub must keep server first paint and avoid a serial client fetch.
- Document review changes must preserve profile ownership, acceptance, review confirmation, and source evidence behavior.

## Done criteria for a follow-up change

- A selected finding has a named deep module in `CONTEXT.md` if it introduces a new domain term.
- The affected interface has scenario coverage for its domain invariant.
- Every current caller migrates to the chosen seam; no deprecated branch or Boolean protocol remains.
- The relevant product flow is exercised end to end.
- Any load-bearing rejection is recorded as an ADR only when it would prevent future re-proposal.

## Verification

- Read `CONTEXT.md`, the available domain documentation, current OpenSpec designs, targeted source modules, and focused verification scripts.
- Examined 45 recent commits to choose hot paths.
- Completed an independent read-only hotspot walk.
- Rendered the accompanying temporary HTML review in Chromium: four candidate cards, eight before/after diagrams, and one Mermaid timeline graph.
