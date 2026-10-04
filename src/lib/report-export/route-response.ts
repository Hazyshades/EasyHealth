import { ReportExportError, type ReportExportErrorCode } from "./index";

export type ReportExportFailureResponse = Readonly<{
  status: number;
  body: Readonly<{ error: string; code: ReportExportErrorCode }>;
}>;

const UNAVAILABLE_MESSAGE = "Export is unavailable";

/**
 * Maps an export failure onto a stable public HTTP response.
 *
 * Messages are fixed strings and codes come from the closed
 * `ReportExportErrorCode` enum, so no report content, validation issue code,
 * or internal exception text can reach the client.
 */
const FAILURES: Readonly<
  Record<ReportExportErrorCode, ReportExportFailureResponse>
> = {
  UNAUTHORIZED: {
    status: 403,
    body: { error: UNAVAILABLE_MESSAGE, code: "UNAUTHORIZED" },
  },
  REPORT_UNAVAILABLE: {
    status: 410,
    body: { error: "Report unavailable", code: "REPORT_UNAVAILABLE" },
  },
  VALIDATION_INVALID: {
    status: 422,
    body: { error: "Report cannot be exported", code: "VALIDATION_INVALID" },
  },
  FORMAT_NOT_ALLOWED: {
    status: 400,
    body: { error: "Export is unavailable", code: "FORMAT_NOT_ALLOWED" },
  },
  DYNAMICS_INVALID: {
    status: 422,
    body: { error: "Report cannot be exported", code: "DYNAMICS_INVALID" },
  },
  REPORT_TOO_LARGE: {
    status: 413,
    body: { error: "Report is too large to export", code: "REPORT_TOO_LARGE" },
  },
  PDF_RENDER_FAILED: {
    status: 500,
    body: { error: "Export failed", code: "PDF_RENDER_FAILED" },
  },
  SERIALIZATION_FAILED: {
    status: 500,
    body: { error: "Export failed", code: "SERIALIZATION_FAILED" },
  },
};

export function classifyReportExportFailure(
  error: unknown,
): ReportExportFailureResponse {
  if (error instanceof ReportExportError) {
    return FAILURES[error.code];
  }
  return FAILURES.SERIALIZATION_FAILED;
}
