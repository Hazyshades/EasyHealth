import { stableStringify } from "./json";
import type { ExportProjection } from "./projection";

export const CSV_EXPORT_VERSION = "eh153.csv.v1" as const;

const CSV_HEADERS = [
  "record_type",
  "export_version",
  "row_order",
  "section",
  "section_order",
  "empty_state",
  "claim_id",
  "claim_kind",
  "claim_status",
  "claim_text",
  "question_text",
  "citation_ids",
  "source_id",
  "source_kind",
  "document_id",
  "source_label",
  "source_snapshot",
  "observed_at",
  "native_value",
  "native_unit",
  "native_reference_low",
  "native_reference_high",
  "display_value",
  "display_unit",
  "display_reference_low",
  "display_reference_high",
  "conversion_indicator",
  "conversion_original_value",
  "conversion_original_unit",
  "conversion_eligible",
  "series_id",
  "measurement_definition_key",
  "series_label",
  "direction",
  "direction_tolerance",
  "period_start",
  "period_end",
  "dynamics_schema_version",
  "dynamics_policy_version",
  "generated_at",
  "contract_version",
  "validator_version",
  "validation_status",
  "disclaimer",
  "limitations",
] as const;

type CsvHeader = (typeof CSV_HEADERS)[number];
type CsvRow = Partial<Record<CsvHeader, unknown>>;

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? stableStringify(value) : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsvProjection(
  projection: ExportProjection,
): Uint8Array {
  const report = projection.report;
  const rows: CsvRow[] = [];
  let rowOrder = 1;
  const add = (row: CsvRow) => {
    rows.push({ row_order: rowOrder, ...row });
    rowOrder += 1;
  };

  add({
    record_type: "metadata",
    export_version: CSV_EXPORT_VERSION,
    generated_at: report.generatedAt,
    contract_version: report.schemaVersion,
    validator_version: report.validation.version,
    validation_status: report.validation.status,
    disclaimer: report.disclaimer,
    limitations: stableStringify(projection.report.limitations),
  });

  const claimById = new Map(report.claims.map((claim) => [claim.id, claim]));
  for (const [sectionIndex, section] of report.sections.entries()) {
    add({
      record_type: "section",
      section: section.id,
      section_order: sectionIndex + 1,
      empty_state: section.empty_state,
    });
    for (const item of section.items) {
      if (item.type !== "claim_ref") continue;
      const claim = claimById.get(item.claim_id);
      if (!claim) continue;
      add({
        record_type: "claim",
        section: section.id,
        claim_id: claim.id,
        claim_kind: claim.kind,
        claim_status: claim.status,
        claim_text: claim.kind === "clinician_question" ? null : claim.text,
        question_text:
          claim.kind === "clinician_question" ? claim.question_text : null,
        citation_ids: claim.citations
          .map((citation) => citation.source_id)
          .join(";"),
      });
    }
  }

  for (const source of report.sourceLedger) {
    add({
      record_type: "source",
      source_id: source.source_id,
      source_kind: source.kind,
      document_id: source.document_id,
      source_label: source.snapshot.label,
      source_snapshot: source.snapshot,
      observed_at: source.snapshot.observed_at,
    });
  }

  if (projection.dynamics) {
    const dynamics = projection.dynamics;
    for (const series of dynamics.series) {
      add({
        record_type: "dynamics_series",
        section: "latest_measurements",
        native_unit: series.statistics.nativeUnit,
        display_unit: series.statistics.displayUnit,
        series_id: series.id,
        measurement_definition_key: series.measurementDefinitionKey,
        series_label: series.label,
        direction: series.direction.value,
        direction_tolerance: series.tolerance ?? series.direction.tolerance,
        period_start: dynamics.period?.start,
        period_end: dynamics.period?.end,
        dynamics_schema_version: dynamics.schemaVersion,
        dynamics_policy_version: dynamics.directionPolicyVersion,
      });
      for (const point of series.points) {
        const conversion = point.conversionMetadata;
        add({
          record_type: "measurement",
          section: "latest_measurements",
          source_id: point.id,
          source_kind: "observation",
          document_id: point.documentId,
          observed_at: point.observedAt,
          native_value: point.nativeValue,
          native_unit: point.nativeUnit,
          native_reference_low: point.nativeReferenceLow,
          native_reference_high: point.nativeReferenceHigh,
          display_value: point.displayValue,
          display_unit: point.displayUnit,
          display_reference_low: point.displayReferenceLow,
          display_reference_high: point.displayReferenceHigh,
          conversion_indicator:
            conversion === null
              ? "not_available"
              : conversion.converted
                ? "converted"
                : "native",
          conversion_original_value: conversion?.originalValue,
          conversion_original_unit: conversion?.originalUnit,
          conversion_eligible: conversion?.conversionEligible,
          series_id: series.id,
          measurement_definition_key: series.measurementDefinitionKey,
          series_label: series.label,
          direction: series.direction.value,
          direction_tolerance: series.direction.tolerance,
          period_start: dynamics.period?.start,
          period_end: dynamics.period?.end,
          dynamics_schema_version: dynamics.schemaVersion,
          dynamics_policy_version: dynamics.directionPolicyVersion,
        });
      }
    }
  }

  const lines = [CSV_HEADERS.join(",")];
  for (const row of rows) {
    lines.push(
      CSV_HEADERS.map((header) => escapeCsvCell(row[header])).join(","),
    );
  }
  return new TextEncoder().encode(`${lines.join("\n")}\n`);
}
