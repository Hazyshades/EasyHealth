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

export type PublicExportRouteContext = {
  params: Promise<{ token: string }>;
};

export type PublicExportRouteDependencies = Readonly<{
  authorizeShareRead: typeof authorizeShareRead;
  loadShareByToken: typeof loadShareByToken;
  consumeFailureRateLimit: typeof consumeFailureRateLimit;
  consumeSelectedShareFailureRateLimit: typeof consumeSelectedShareFailureRateLimit;
  recordAndConsumeSelectedShareFailure: typeof recordAndConsumeSelectedShareFailure;
  verifyPublicBoundary: typeof verifyPublicBoundary;
  createReportExportResponse: typeof createReportExportResponse;
  isExportFormat: typeof isExportFormat;
  renderReportExport: typeof renderReportExport;
  applyPublicShareExportResponsePolicy: typeof applyPublicShareExportResponsePolicy;
  publicShareError: typeof publicShareError;
  publicShareJson: typeof publicShareJson;
}>;

const defaultPublicExportRouteDependencies: PublicExportRouteDependencies = {
  authorizeShareRead,
  loadShareByToken,
  consumeFailureRateLimit,
  consumeSelectedShareFailureRateLimit,
  recordAndConsumeSelectedShareFailure,
  verifyPublicBoundary,
  createReportExportResponse,
  isExportFormat,
  renderReportExport,
  applyPublicShareExportResponsePolicy,
  publicShareError,
  publicShareJson,
};

function containsPinMaterial(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.has("pin") ||
    request.headers.has("x-share-pin") ||
    request.headers.has("x-eh-share-pin") ||
    /(?:^|;\s*)pin=/i.test(request.headers.get("cookie") ?? "")
  );
}

export async function handlePublicShareExport(
  request: NextRequest,
  context: PublicExportRouteContext,
  dependencies: PublicExportRouteDependencies = defaultPublicExportRouteDependencies,
) {
  const boundary = dependencies.verifyPublicBoundary(request);
  if (boundary instanceof Response) return boundary;

  const { token } = await context.params;
  let lookup: ShareLookup;
  try {
    lookup = await dependencies.loadShareByToken(token);
  } catch (error) {
    if (error instanceof ShareServiceError)
      return dependencies.publicShareError(error);
    const limited = await dependencies.consumeFailureRateLimit({
      tokenKey: null,
      boundary,
    });
    if (limited) return limited;
    return dependencies.publicShareError(error);
  }

  if (containsPinMaterial(request)) {
    const limited = await dependencies.recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "export",
      result: "denied",
    });
    if (limited) return limited;
    return dependencies.publicShareJson({ error: "Share unavailable" }, 404);
  }

  const requested = request.nextUrl.searchParams.get("format");
  if (!requested || !dependencies.isExportFormat(requested)) {
    const limited = await dependencies.recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "export",
      result: "denied",
    });
    if (limited) return limited;
    return dependencies.publicShareError(new ShareUnavailableError());
  }

  try {
    const result = await dependencies.authorizeShareRead({
      token,
      cookieHeader: request.headers.get("cookie"),
      resource: { kind: "export", format: requested },
      clientClass: boundary.clientClass,
      deferSuccessfulAccess: true,
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
      allowedExportFormats: result.lookup.share.allowed_export_formats.filter(
        dependencies.isExportFormat,
      ),
    };
    const file = await dependencies.renderReportExport(
      { kind: "share", capability },
      requested,
      { reportId: result.lookup.share.report_id },
    );
    const response = dependencies.createReportExportResponse(file, {
      kind: "share",
      applyPublicShareResponsePolicy:
        dependencies.applyPublicShareExportResponsePolicy,
    });
    await result.complete();
    return response;
  } catch (error) {
    if (
      error instanceof SharePinRequiredError ||
      error instanceof ShareUnavailableError
    ) {
      const limited = await dependencies.consumeSelectedShareFailureRateLimit({
        lookup,
        boundary,
        resourceKind: "export",
      });
      if (limited) return limited;
    }
    return dependencies.publicShareError(error);
  }
}

export async function GET(
  request: NextRequest,
  context: PublicExportRouteContext,
) {
  return handlePublicShareExport(request, context);
}
