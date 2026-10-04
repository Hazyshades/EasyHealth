# Design: eh-148-owner-report-export-surface

## Context

EH-153 delivers the export boundary. This change makes it reachable for owners and only for owners.

Two constraints shape the design. First, EH-153's contract says the route must not be able to widen scope, so the route may not re-implement authorization. Second, the export package treats every failure as a generic safe error; the HTTP layer must not become a channel that recovers the internal detail EH-153 deliberately hides.

## Goals / Non-Goals

**Goals:**

- One owner-scoped route that returns EH-153 bytes unchanged.
- Public failures that carry a stable code and a fixed message.
- Export controls on the authenticated detail page, present exactly when export is permitted.
- A download sink that cannot be redirected outside the download folder.

**Non-Goals:**

- Public-share exports, the share integration slot, or share-token handling (EH-151).
- Any change to the export projection, serializers, PDF, or the persisted dynamics reader.
- New report content semantics or changes to how the report renders.

## Decisions

### 1. Keep the route a thin adapter

`src/app/api/reports/[id]/export/route.ts` does three things: resolve the session, validate the requested format against `REPORT_EXPORT_FORMATS`, and delegate.

```text
session -> 401
format not in {pdf,csv,json} -> FORMAT_NOT_ALLOWED
otherwise -> renderReportExport({kind:"owner", profileId}, format, {reportId})
```

Authorization, the `export`-mode resolver read, the report-scope ledger, and serialization all stay in `renderReportExport`. The route holds no report logic, so it cannot become a second, weaker authorization path.

### 2. Authenticate before reading the format

The format check runs after the session check. An anonymous caller receives `401` regardless of what it asked for, so the endpoint cannot be used to enumerate which formats a report would have supported. Format validation still precedes any export work, so a malformed request never triggers a report read.

### 3. Map failures in one place

`src/lib/report-export/route-response.ts` holds a closed `ReportExportErrorCode -> {status, body}` table. Each entry carries a fixed message string; the code is echoed because it comes from an eight-value export enum that contains no report content. Anything that is not a `ReportExportError` maps to `SERIALIZATION_FAILED`, so an unexpected throw produces the same generic response as a known failure.

The route never forwards `error.message`.

### 4. Gate the actions on the read result

The detail page already receives `status` and `can_export`. Availability is computed once as `status === "structured" && can_export`, so a legacy report — which is explicitly un-shareable and un-exportable — renders no actions at all rather than actions that fail. The actions render in exactly one place in the tree, inside the gated branch.

### 5. Sanitize the filename at the sink

EH-153's `safeFilename` and RFC 5987 encoding already make the header safe. `attachmentFilename` re-reads that header in the browser, prefers `filename*`, decodes it, and strips path separators and control characters once more. This is the last point before the browser writes to disk, so it does not trust the header even though the server produced it. A malformed percent-encoding or a whitespace-only name falls back rather than throwing into the download path.

### 6. Release the object URL

The download uses an `object:` URL for the blob. The handler revokes it in a `finally` block, including when the synthetic anchor click throws, so a repeated export does not leak blobs.

## Risks / Trade-offs

- **Blobs pass through the client.** A file download for PDF/CSV/JSON of a bounded report is small, and `fetch` + blob keeps error handling and the filename in one place. A direct `<a href>` would avoid the buffer but could not distinguish a 410 "report unavailable" from a successful download.
- **One fetch per export.** No prefetch or cache. Report exports are infrequent and the payload is user-initiated.
- **The route is a new public HTTP surface.** It is owner-only, delegates all scope work to EH-153, and is covered by the same fail-closed contract; EH-154's threat model should include it.
