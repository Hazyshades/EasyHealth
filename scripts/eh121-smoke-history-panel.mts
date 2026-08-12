/**
 * EH-121 change-history render smoke test: take real
 * `observation_change_events` rows, run them through the real read model, and
 * render the real review panel to a standalone HTML page.
 *
 * The rows are supplied as JSON so the script needs no database driver. Produce
 * them from any environment with:
 *
 *   psql -At -c "select coalesce(json_agg(event), '[]') from (
 *     select id, event_kind, origin, observation_id, extracted_biomarker_id,
 *            source_revision_id, source_prior_revision_id, source_reprocess_row_id,
 *            actor_type, actor_id, correction_reason,
 *            prior_measurement_definition_key, prior_analyte_key,
 *            prior_resolver_result, prior_verification_status,
 *            prior_mapping_confidence_band, prior_input_evidence_hash,
 *            next_measurement_definition_key, next_analyte_key,
 *            next_resolver_result, next_verification_status,
 *            next_mapping_confidence_band, next_input_evidence_hash,
 *            next_mapping_change_classification, catalog_manifest_version,
 *            catalog_manifest_digest, resolver_version, normalization_version,
 *            extraction_version, occurred_at, created_at
 *     from public.observation_change_events order by occurred_at desc) as event"
 *
 * Usage: tsx scripts/eh121-smoke-history-panel.mts <events.json> [viewerProfileId] [out.html]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildObservationChangeEntries,
  indexObservationChangeEntries,
  type ObservationChangeEventRow,
} from "../src/lib/documents/observation-change-history";

// tsx compiles JSX with the classic runtime, so the component's JSX needs a
// global React. globalThis has no React member to widen into, so the cast is
// unavoidable and is named rather than inlined into the assignment target.
const globalScope = globalThis as unknown as { React: typeof React };
globalScope.React = React;
const { ObservationChangeHistoryPanel } = await import(
  "../src/components/documents/review/observation-change-history-panel"
);

const [eventsPath, viewerProfileId, outPath = ".artifacts/eh121-history.html"] =
  process.argv.slice(2);
if (!eventsPath) {
  console.error("usage: tsx scripts/eh121-smoke-history-panel.mts <events.json> [viewerProfileId] [out.html]");
  process.exit(2);
}


const parsed: unknown = JSON.parse(readFileSync(eventsPath, "utf8"));
if (!Array.isArray(parsed)) {
  console.error(`${eventsPath} must contain a JSON array of ledger rows`);
  process.exit(2);
}
// The projection rejects anything it does not recognize, so the rows only need
// to be an array here; every field is validated as it is read.
const rows = parsed as ObservationChangeEventRow[];
const entries = buildObservationChangeEntries(rows, { viewerProfileId });
const index = indexObservationChangeEntries(entries);

console.log(`rows=${rows.length} entries=${entries.length} rowsWithHistory=${index.size}`);
for (const entry of entries) {
  const diff = entry.fields
    .map((field) => `${field.label} ${field.from ?? "-"}→${field.to ?? "-"}`)
    .join("; ");
  console.log(
    `- ${entry.occurredAt} ${entry.kind} by ${entry.actorLabel}${
      entry.reconstructed ? " (reconstructed)" : ""
    }${diff ? ` :: ${diff}` : ""}${entry.reason ? ` :: reason=${entry.reason}` : ""}`,
  );
}

const panel = renderToStaticMarkup(
  React.createElement(ObservationChangeHistoryPanel, { entries }),
);
const empty = renderToStaticMarkup(
  React.createElement(ObservationChangeHistoryPanel, { entries: [] }),
);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(
  outPath,
  `<!doctype html><meta charset="utf-8">
<style>
  :root {
    --eh-text-secondary: #334155;
    --eh-text-muted: #64748b;
  }
  body { margin: 0; padding: 24px; background: #f8fafc; font: 14px system-ui, sans-serif; }
  .card { max-width: 520px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; margin-bottom: 16px; }
  .mt-2 { margin-top: .5rem; } .mt-1 { margin-top: .25rem; }
  .pt-2 { padding-top: .5rem; }
  .border-t { border-top: 1px solid #f1f5f9; }
  .text-xs { font-size: 12px; }
  .font-medium { font-weight: 500; }
  .cursor-pointer { cursor: pointer; }
  .flex { display: flex; } .flex-wrap { flex-wrap: wrap; }
  .items-center { align-items: center; } .gap-1\\.5 { gap: 6px; }
  ol, ul { margin: 0; padding-left: 1rem; }
  .space-y-2 > * + * { margin-top: .5rem; }
  .space-y-0\\.5 > * + * { margin-top: 2px; }
  .leading-relaxed { line-height: 1.6; }
  .text-\\[var\\(--eh-text-secondary\\)\\] { color: var(--eh-text-secondary); }
  .text-\\[var\\(--eh-text-muted\\)\\] { color: var(--eh-text-muted); }
</style>
<div class="card"><strong>With history</strong>${panel}</div>
<div class="card"><strong>No history</strong>${empty}</div>`,
);
console.log(`wrote ${outPath}`);
