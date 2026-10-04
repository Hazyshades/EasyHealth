import { NextRequest } from "next/server";
import {
  getOwnedDocument,
  getOriginalPath,
  guessMimeType,
} from "@/lib/documents/access";
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
import {
  publicShareError,
  publicShareJson,
} from "@/lib/share-links/route-responses";
import { applyPublicShareResponsePolicy } from "@/lib/share-links/public-response-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { LAB_DOCUMENTS_BUCKET } from "@/lib/supabase/storage";

type RouteContext = {
  params: Promise<{ token: string; documentId: string }>;
};

function containsPinMaterial(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.has("pin") ||
    request.headers.has("x-share-pin") ||
    request.headers.has("x-eh-share-pin") ||
    /(?:^|;\s*)pin=/i.test(request.headers.get("cookie") ?? "")
  );
}

function safeFilename(filename: string): string {
  const value = filename
    .replace(/[\\/\u0000-\u001f\u007f]/g, "_")
    .replace(/"/g, "_")
    .trim()
    .slice(0, 120);
  return value || "shared-document";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const boundary = verifyPublicBoundary(request);
  if (boundary instanceof Response) return boundary;

  const { token, documentId } = await context.params;

  let lookup: Awaited<ReturnType<typeof loadShareByToken>>;
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
      resourceKind: "document",
      result: "denied",
    });
    if (limited) return limited;
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  type OwnedDocument = NonNullable<
    Awaited<ReturnType<typeof getOwnedDocument>>
  >;
  try {
    let documentRow: OwnedDocument | null = null;
    let documentData: Blob | null = null;
    await authorizeShareRead({
      token,
      cookieHeader: request.headers.get("cookie"),
      resource: { kind: "document", documentId },
      clientClass: boundary.clientClass,
      beforeAllowedBytes: async (shareLookup) => {
        documentRow = await getOwnedDocument(
          shareLookup.share.profile_id,
          documentId,
        );
        if (!documentRow) return false;
        const storagePath = getOriginalPath(documentRow);
        const { data, error } = await createAdminClient()
          .storage.from(LAB_DOCUMENTS_BUCKET)
          .download(storagePath);
        if (error || !data) throw new ShareServiceError();
        documentData = data;
        return true;
      },
    });

    const downloadedDocument = documentRow as OwnedDocument | null;
    const downloadedData = documentData as Blob | null;
    if (downloadedDocument === null || downloadedData === null) {
      throw new ShareServiceError();
    }

    const headers = new Headers({
      "Content-Type": guessMimeType(
        downloadedDocument.original_filename,
        downloadedDocument.mime_type,
      ),
      "Content-Disposition": `attachment; filename="${safeFilename(downloadedDocument.original_filename)}"`,
      "Content-Length": String(downloadedData.size),
    });
    const response = new Response(downloadedData, { status: 200, headers });
    applyPublicShareResponsePolicy(response);
    return response;
  } catch (error) {
    if (
      error instanceof SharePinRequiredError ||
      error instanceof ShareUnavailableError
    ) {
      const limited = await consumeSelectedShareFailureRateLimit({
        lookup,
        boundary,
        resourceKind: "document",
      });
      if (limited) return limited;
    }
    return publicShareError(error);
  }
}
