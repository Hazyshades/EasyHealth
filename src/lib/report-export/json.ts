import type { ExportProjection } from "./projection";

export const JSON_EXPORT_VERSION = "eh153.json.v1" as const;

function stableValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("EXPORT_VALUE_NOT_SERIALIZABLE");
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableValue).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableValue(entry)}`)
      .join(",")}}`;
  }
  throw new Error("EXPORT_VALUE_NOT_SERIALIZABLE");
}

export function stableStringify(value: unknown): string {
  return stableValue(value);
}

export function serializeJsonProjection(
  projection: ExportProjection,
): Uint8Array {
  const report = projection.report;
  const payload = {
    export_format: "json",
    export_version: JSON_EXPORT_VERSION,
    contract: {
      version: report.schemaVersion,
      kind: report.reportKind,
    },
    validator: {
      version: report.validation.version,
      status: report.validation.status,
    },
    report: {
      id: report.id,
      title: report.title,
      report_type: report.reportType,
      detail_level: report.detailLevel,
      abnormal_only: report.abnormalOnly,
      generated_at: report.generatedAt,
      requested_scope: report.requestedScope,
      source_scope_document_ids: report.sourceDocumentIds,
      sections: report.sections,
      claims: report.claims,
      limitations: report.limitations,
      source_ledger: report.sourceLedger,
      disclaimer: report.disclaimer,
      overview: report.overview,
      validation: report.validation,
    },
    dynamics: projection.dynamics,
  };
  return new TextEncoder().encode(`${stableStringify(payload)}\n`);
}
