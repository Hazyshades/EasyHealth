import { NextRequest } from "next/server";
import {
  authorizeShareRead,
  loadShareByToken,
  SharePinRequiredError,
  ShareServiceError,
  ShareUnavailableError,
} from "@/lib/share-links/authorization";
import { shareTokenDigestKey } from "@/lib/share-links/rate-limit";
import { getPublicShareExportActions } from "@/lib/share-links/public-export-actions";
import {
  consumeFailureRateLimit,
  verifyPublicBoundary,
} from "@/lib/share-links/public-boundary";
import {
  publicShareError,
  publicShareJson,
} from "@/lib/share-links/route-responses";

type RouteContext = { params: Promise<{ token: string }> };

function containsPinMaterial(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.has("pin") ||
    request.headers.has("x-share-pin") ||
    request.headers.has("x-eh-share-pin")
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const boundary = verifyPublicBoundary(request);
  if (boundary instanceof Response) return boundary;
  if (containsPinMaterial(request)) {
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

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

  try {
    const result = await authorizeShareRead({
      token,
      cookieHeader: request.headers.get("cookie"),
      resource: { kind: "report" },
      clientClass: boundary.clientClass,
    });
    const report = result.reportRead.report;
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
      let tokenKey: string;
      try {
        tokenKey = shareTokenDigestKey(lookup.token.tokenDigest);
      } catch (rateError) {
        return publicShareError(rateError);
      }
      const limited = await consumeFailureRateLimit({ tokenKey, boundary });
      if (limited) return limited;
    }
    return publicShareError(error);
  }
}
