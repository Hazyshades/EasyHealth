import { NextRequest } from "next/server";
import {
  authorizeShareRead,
  loadShareByToken,
  SharePinRequiredError,
  ShareServiceError,
  ShareUnavailableError,
  type ShareLookup,
} from "@/lib/share-links/authorization";
import {
  consumeFailureRateLimit,
  consumeSelectedShareFailureRateLimit,
  recordAndConsumeSelectedShareFailure,
  verifyPublicBoundary,
} from "@/lib/share-links/public-boundary";
import {
  createReportExportResponse,
  isExportFormat,
  renderReportExport,
  type ReportShareExportCapability,
} from "@/lib/report-export";
import { applyPublicShareExportResponsePolicy } from "@/lib/share-links/public-export-actions";
import {
  publicShareError,
  publicShareJson,
} from "@/lib/share-links/route-responses";

type RouteContext = { params: Promise<{ token: string }> };

function containsPinMaterial(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.has("pin") ||
    request.headers.has("x-share-pin") ||
    request.headers.has("x-eh-share-pin") ||
    /(?:^|;\s*)pin=/i.test(request.headers.get("cookie") ?? "")
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const boundary = verifyPublicBoundary(request);
  if (boundary instanceof Response) return boundary;

  const { token } = await context.params;
  let lookup: ShareLookup;
  try {
    lookup = await loadShareByToken(token);
  } catch (error) {
    if (error instanceof ShareServiceError) return publicShareError(error);
    const limited = await consumeFailureRateLimit({
      tokenKey: null,
      boundary,
    });
    if (limited) return limited;
    return publicShareError(error);
  }

  if (containsPinMaterial(request)) {
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "export",
      result: "denied",
    });
    if (limited) return limited;
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  const requested = request.nextUrl.searchParams.get("format");
  if (!requested || !isExportFormat(requested)) {
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "export",
      result: "denied",
    });
    if (limited) return limited;
    return publicShareError(new ShareUnavailableError());
  }

  try {
    const result = await authorizeShareRead({
      token,
      cookieHeader: request.headers.get("cookie"),
      resource: { kind: "export", format: requested },
      clientClass: boundary.clientClass,
    });
    const capability: ReportShareExportCapability = {
      reportId: result.lookup.share.report_id,
      ownerProfileId: result.lookup.share.profile_id,
      reportScopeDocumentIds:
        result.reportRead.report.content.source_document_ids,
      rawDocumentIds:
        result.lookup.share.download_policy === "documents"
          ? result.lookup.share.document_ids
          : [],
      downloadPolicy: result.lookup.share.download_policy,
      allowedExportFormats:
        result.lookup.share.allowed_export_formats.filter(isExportFormat),
    };
    const file = await renderReportExport(
      { kind: "share", capability },
      requested,
      { reportId: result.lookup.share.report_id },
    );
    return createReportExportResponse(file, {
      kind: "share",
      applyPublicShareResponsePolicy: applyPublicShareExportResponsePolicy,
    });
  } catch (error) {
    if (
      error instanceof SharePinRequiredError ||
      error instanceof ShareUnavailableError
    ) {
      const limited = await consumeSelectedShareFailureRateLimit({
        lookup,
        boundary,
        resourceKind: "export",
      });
      if (limited) return limited;
    }
    return publicShareError(error);
  }
}
