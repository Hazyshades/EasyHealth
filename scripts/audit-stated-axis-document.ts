/**
 * #106: point the stated-axis auditor at a stored document.
 *
 * Answers, without re-running extraction: does any current extracted row claim a
 * clinical axis its own captured provenance does not contain? Also reports what
 * the resolver decides for those rows now, so the effect of the stated-evidence
 * policy is visible on real data.
 *
 * Read-only. Requires service-role credentials; run it through the wired script
 * so Node loads `.env` before module evaluation:
 *
 *   pnpm audit:stated-axis -- <documentId>
 */
import { createClient } from "@supabase/supabase-js";
import { resolveMeasurementDefinition, uncoveredCapturedHeadings } from "../src/lib/biomarkers";
import { auditUnstatedAxes } from "../src/lib/documents/stated-axis-evidence";
import {
  measurementInputFromWriterRow,
  type ExtractedBiomarkerWriterRow,
} from "../src/lib/documents/observation-normalization-writer";

const EXTRACTED_SELECT =
  "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, method, source_page, source_text, reported_alt_value, reported_alt_unit, raw_value_text, processing_version";

async function main(): Promise<number> {
  const documentId = process.argv[2];
  if (!documentId) {
    console.error("usage: pnpm audit:stated-axis -- <documentId>");
    return 2;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("document_extracted_biomarkers")
    .select(EXTRACTED_SELECT)
    .eq("document_id", documentId)
    .eq("is_current", true)
    .order("biomarker_name");
  if (error) throw error;

  const rows = (data ?? []) as unknown as ExtractedBiomarkerWriterRow[];
  console.log(`document ${documentId}: ${rows.length} current extracted rows`);

  const findings = auditUnstatedAxes(rows);
  console.log(`\nrows claiming an unstated axis: ${findings.length} / ${rows.length}`);
  for (const finding of findings) {
    const detail = finding.inferences
      .map(({ axis, discarded }) => `${axis}=${discarded}`)
      .join(", ");
    console.log(`  ${finding.label.slice(0, 46).padEnd(46)} ${detail}`);
  }

  const outcomes: Record<string, number> = {};
  for (const row of rows) {
    const resolution = resolveMeasurementDefinition(measurementInputFromWriterRow(row));
    outcomes[resolution.result] = (outcomes[resolution.result] ?? 0) + 1;
  }
  console.log(
    `\nresolver outcome with the stated-evidence policy applied: ${JSON.stringify(outcomes)}`,
  );

  const glucose = rows.find((row) => /glucose/i.test(row.raw_name ?? row.biomarker_name));
  if (glucose) {
    const resolution = resolveMeasurementDefinition(measurementInputFromWriterRow(glucose));
    console.log(
      `glucose row -> ${resolution.result} key=${resolution.measurementDefinitionKey ?? "-"} missingAxes=${JSON.stringify(resolution.missingAxes)}`,
    );
  }

  const uncovered = uncoveredCapturedHeadings(
    rows.map((row) => ({ heading: row.section_context, count: 1 })),
  );
  console.log(`\ncaptured headings with no reviewed panel policy: ${uncovered.length}`);
  for (const row of uncovered) {
    console.log(`  ${row.count}× ${row.heading}`);
  }

  return findings.length > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
