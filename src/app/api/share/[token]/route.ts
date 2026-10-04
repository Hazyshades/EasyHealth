import { NextRequest } from "next/server";
import { getOwnedDocument } from "@/lib/documents/access";
import {
  authorizeShareRead,
  loadShareByToken,
  SharePinRequiredError,
  ShareServiceError,
  ShareUnavailableError,
} from "@/lib/share-links/authorization";
import {
  consumeFailureRateLimit,
  consumeSelectedShareFailureRateLimit,
  recordAndConsumeSelectedShareFailure,
  verifyPublicBoundary,
} from "@/lib/share-links/public-boundary";
import { getPublicShareExportActions } from "@/lib/share-links/public-export-actions";
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
  let lookup;
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
      resourceKind: "report",
      result: "denied",
    });
    if (limited) return limited;
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  try {
    const result = await authorizeShareRead({
      token,
      cookieHeader: request.headers.get("cookie"),
      resource: { kind: "report" },
      clientClass: boundary.clientClass,
    });
    const report = result.reportRead.report;
    const documents: Array<{ id: string; filename: string }> =
      lookup.share.download_policy === "documents"
        ? (
            await Promise.all(
              lookup.share.document_ids.map(async (documentId) => {
                const document = await getOwnedDocument(
                  lookup.share.profile_id,
                  documentId,
                );
                return document
                  ? {
                      id: document.id,
                      filename: document.original_filename,
                    }
                  : null;
              }),
            )
          ).filter(
            (document): document is { id: string; filename: string } =>
              document !== null,
          )
        : [];
    return publicShareJson({
      status: "structured",
      report: {
        title: report.title,
        report_type: report.report_type,
        detail_level: report.detail_level,
        abnormal_only: report.abnormal_only,
        content: report.content,
        summary_preview: report.summary_preview,
        created_at: report.created_at,
      },
      download_policy: lookup.share.download_policy,
      documents,
      allowed_export_formats: lookup.share.allowed_export_formats,
      export_actions: getPublicShareExportActions(
        lookup.share.allowed_export_formats,
      ),
    });
  } catch (error) {
    if (
      error instanceof SharePinRequiredError ||
      error instanceof ShareUnavailableError
    ) {
      const limited = await consumeSelectedShareFailureRateLimit({
        lookup,
        boundary,
        resourceKind: "report",
      });
      if (limited) return limited;
    }
    return publicShareError(error);
  }
}
