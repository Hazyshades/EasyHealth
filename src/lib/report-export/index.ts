import { Buffer } from "node:buffer";

import { resolvePersistedBiomarkerDynamicsExtension } from "@/lib/biomarker-dynamics";
import {
  assertDoctorVisitBrief,
  type DoctorVisitBrief,
} from "@/lib/report-contract";
import { resolveReportRead, type ReportReadResult } from "@/lib/report-read";
import { serializeCsvProjection } from "./csv";
import { serializeJsonProjection } from "./json";
import { renderPdfProjection } from "./pdf";
import { buildExportProjection } from "./projection";
import {
  REPORT_EXPORT_FORMATS,
  type ExportableReport,
  type ReportExportAccessContext,
  type ReportExportFile,
  type ReportExportFormat,
  type ReportShareExportCapability,
} from "./types";

export type ReportExportErrorCode =
  | "UNAUTHORIZED"
  | "REPORT_UNAVAILABLE"
  | "VALIDATION_INVALID"
  | "FORMAT_NOT_ALLOWED"
  | "DYNAMICS_INVALID"
  | "REPORT_TOO_LARGE"
  | "PDF_RENDER_FAILED"
  | "SERIALIZATION_FAILED";

export class ReportExportError extends Error {
  readonly code: ReportExportErrorCode;

  constructor(code: ReportExportErrorCode, message: string) {
    super(message);
    this.name = "ReportExportError";
    this.code = code;
  }
}

export type ReportReadResolver = (options: {
  profileId: string;
  reportId: string;
  mode: "export";
}) => Promise<ReportReadResult>;

export type GetExportableReportInput = Readonly<{
  reportId: string;
  readReport?: ReportReadResolver;
}>;

export type PublicShareResponsePolicy = (response: Response) => Response;

const MAX_REPORT_INPUT_BYTES = 1_000_000;
const CONTENT_TYPES: Record<ReportExportFormat, string> = {
  pdf: "application/pdf",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
};

function isExportFormat(value: string): value is ReportExportFormat {
  return (REPORT_EXPORT_FORMATS as readonly string[]).includes(value);
}

function hasSameIds(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return (
    leftSet.size === left.length &&
    rightSet.size === right.length &&
    leftSet.size === rightSet.size &&
    left.every((value) => rightSet.has(value))
  );
}

function validateShareCapability(
  capability: ReportShareExportCapability,
  reportId: string,
  format: ReportExportFormat,
): void {
  const hasReportScopeDocumentIds =
    Array.isArray(capability.reportScopeDocumentIds) &&
    capability.reportScopeDocumentIds.every(
      (value) => typeof value === "string" && value.length > 0,
    );
  const hasRawDocumentIds =
    Array.isArray(capability.rawDocumentIds) &&
    capability.rawDocumentIds.every(
      (value) => typeof value === "string" && value.length > 0,
    );
  const hasAllowedFormats =
    Array.isArray(capability.allowedExportFormats) &&
    capability.allowedExportFormats.every(
      (value) => typeof value === "string" && isExportFormat(value),
    );
  if (
    typeof capability.ownerProfileId !== "string" ||
    capability.ownerProfileId.length === 0 ||
    typeof capability.reportId !== "string" ||
    capability.reportId !== reportId ||
    !hasReportScopeDocumentIds ||
    !hasRawDocumentIds ||
    !hasAllowedFormats ||
    (capability.downloadPolicy !== "report" &&
      capability.downloadPolicy !== "documents") ||
    (capability.downloadPolicy === "report" &&
      capability.rawDocumentIds.length > 0)
  ) {
    throw new ReportExportError("UNAUTHORIZED", "Export is unavailable");
  }
  if (!capability.allowedExportFormats.includes(format)) {
    throw new ReportExportError("FORMAT_NOT_ALLOWED", "Export is unavailable");
  }
  const rawDocumentIds = new Set(capability.rawDocumentIds);
  if (
    rawDocumentIds.size !== capability.rawDocumentIds.length ||
    capability.rawDocumentIds.some(
      (documentId) => !capability.reportScopeDocumentIds.includes(documentId),
    )
  ) {
    throw new ReportExportError("UNAUTHORIZED", "Export is unavailable");
  }
}

function accessProfileId(
  accessContext: ReportExportAccessContext,
  reportId: string,
  format: ReportExportFormat,
): string {
  if (accessContext.kind === "owner") {
    if (
      typeof accessContext.profileId !== "string" ||
      accessContext.profileId.length === 0
    ) {
      throw new ReportExportError("UNAUTHORIZED", "Export is unavailable");
    }
    return accessContext.profileId;
  }
  if (
    !accessContext.capability ||
    typeof accessContext.capability !== "object"
  ) {
    throw new ReportExportError("UNAUTHORIZED", "Export is unavailable");
  }
  validateShareCapability(accessContext.capability, reportId, format);
  return accessContext.capability.ownerProfileId;
}

function readStructuredBrief(result: ReportReadResult): {
  report: Extract<ReportReadResult, { status: "structured" }>["report"];
  brief: DoctorVisitBrief;
} {
  if (result.status !== "structured") {
    throw new ReportExportError(
      "REPORT_UNAVAILABLE",
      "Report export is unavailable",
    );
  }
  try {
    return {
      report: result.report,
      brief: assertDoctorVisitBrief(result.report.content),
    };
  } catch {
    throw new ReportExportError(
      "VALIDATION_INVALID",
      "Report export is unavailable",
    );
  }
}

function readDynamics(brief: DoctorVisitBrief): ExportableReport["dynamics"] {
  if (
    !brief.extensions ||
    !Object.prototype.hasOwnProperty.call(
      brief.extensions,
      "biomarker_dynamics",
    )
  ) {
    return null;
  }
  let resolved: ReturnType<typeof resolvePersistedBiomarkerDynamicsExtension>;
  try {
    resolved = resolvePersistedBiomarkerDynamicsExtension(
      brief.extensions.biomarker_dynamics,
      brief.source_document_ids,
    );
  } catch {
    throw new ReportExportError(
      "DYNAMICS_INVALID",
      "Report export is unavailable",
    );
  }
  if (
    !resolved.ok ||
    resolved.extension.report.generationMetadata.scopeKind !==
      "report_immutable"
  ) {
    throw new ReportExportError(
      "DYNAMICS_INVALID",
      "Report export is unavailable",
    );
  }
  return resolved.extension;
}

function assertReportSize(brief: DoctorVisitBrief): void {
  let size: number;
  try {
    size = new TextEncoder().encode(JSON.stringify(brief)).byteLength;
  } catch {
    throw new ReportExportError("VALIDATION_INVALID", "Export is unavailable");
  }
  if (size > MAX_REPORT_INPUT_BYTES) {
    throw new ReportExportError(
      "REPORT_TOO_LARGE",
      "Report export is unavailable",
    );
  }
}
export async function getExportableReport(
  accessContext: ReportExportAccessContext,
  format: ReportExportFormat,
  input: GetExportableReportInput,
): Promise<ExportableReport> {
  if (
    !isExportFormat(format) ||
    typeof input?.reportId !== "string" ||
    input.reportId.length === 0
  ) {
    throw new ReportExportError("FORMAT_NOT_ALLOWED", "Export is unavailable");
  }
  const profileId = accessProfileId(accessContext, input.reportId, format);
  const readReport = input.readReport ?? resolveReportRead;
  let result: ReportReadResult;
  try {
    result = await readReport({
      profileId,
      reportId: input.reportId,
      mode: "export",
    });
  } catch {
    throw new ReportExportError(
      "REPORT_UNAVAILABLE",
      "Report export is unavailable",
    );
  }
  const { report, brief } = readStructuredBrief(result);
  assertReportSize(brief);

  const reportScopeDocumentIds = [...brief.source_document_ids];
  let rawDocumentIds: readonly string[] = [];
  if (accessContext.kind === "share") {
    const capability = accessContext.capability;
    if (
      !hasSameIds(capability.reportScopeDocumentIds, reportScopeDocumentIds)
    ) {
      throw new ReportExportError("UNAUTHORIZED", "Export is unavailable");
    }
    rawDocumentIds = [...capability.rawDocumentIds];
  }

  return {
    format,
    reportId: report.id,
    report: {
      id: report.id,
      title: report.title,
      report_type: report.report_type,
      detail_level: report.detail_level,
      abnormal_only: report.abnormal_only,
      created_at: report.created_at,
    },
    brief,
    sourceLedger: brief.sources,
    validation: brief.validation,
    dynamics: readDynamics(brief),
    reportScopeDocumentIds,
    rawDocumentIds,
  };
}

export async function serializeReportExport(
  exportable: ExportableReport,
  format: ReportExportFormat = exportable.format,
): Promise<Uint8Array> {
  if (format !== exportable.format) {
    throw new ReportExportError("FORMAT_NOT_ALLOWED", "Export is unavailable");
  }
  const projection = buildExportProjection(exportable);
  try {
    if (format === "json") return serializeJsonProjection(projection);
    if (format === "csv") return serializeCsvProjection(projection);
    return await renderPdfProjection(projection);
  } catch (error) {
    if (error instanceof ReportExportError) throw error;
    if (error instanceof Error && error.message === "PDF_REPORT_TOO_LARGE") {
      throw new ReportExportError(
        "REPORT_TOO_LARGE",
        "Report export is unavailable",
      );
    }
    if (format === "pdf") {
      throw new ReportExportError(
        "PDF_RENDER_FAILED",
        "PDF export is unavailable",
      );
    }
    throw new ReportExportError(
      "SERIALIZATION_FAILED",
      "Report export is unavailable",
    );
  }
}

function safeFilename(title: string, format: ReportExportFormat): string {
  const normalizedBase = title
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const base = Array.from(normalizedBase, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0xd800 && codePoint <= 0xdfff ? "\uFFFD" : character;
  })
    .slice(0, 80)
    .join("")
    .trim();
  return `${base || "health-report"}.${format}`;
}

export async function renderReportExport(
  accessContext: ReportExportAccessContext,
  format: ReportExportFormat,
  input: GetExportableReportInput,
): Promise<ReportExportFile> {
  const exportable = await getExportableReport(accessContext, format, input);
  const bytes = await serializeReportExport(exportable, format);
  return {
    bytes,
    contentType: CONTENT_TYPES[format],
    filename: safeFilename(exportable.report.title, format),
  };
}

export function createReportExportResponse(
  file: ReportExportFile,
  applyPublicShareResponsePolicy?: PublicShareResponsePolicy,
): Response {
  const asciiFilename = file.filename.replace(/[^\x20-\x7e]/gu, "_");
  const response = new Response(Buffer.from(file.bytes), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
  return applyPublicShareResponsePolicy
    ? applyPublicShareResponsePolicy(response)
    : response;
}

export { serializeCsvProjection } from "./csv";
export { serializeJsonProjection, stableStringify } from "./json";
export { renderPdfProjection } from "./pdf";
export type {
  ExportDynamics,
  ExportDynamicsPoint,
  ExportDynamicsSeries,
  ExportProjection,
} from "./projection";
export type {
  ExportableReport,
  ReportDownloadPolicy,
  ReportExportAccessContext,
  ReportExportFile,
  ReportExportFormat,
  ReportShareExportCapability,
} from "./types";
