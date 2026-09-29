import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getOwnedDocument,
  getOriginalPath,
  guessMimeType,
} from "@/lib/documents/access";
import {
  authorizeShareRead,
  loadShareByToken,
  ShareServiceError,
  ShareUnavailableError,
} from "@/lib/share-links/authorization";
import {
  consumeFailureRateLimit,
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

const DocumentId = z.string().uuid();

function containsPinMaterial(request: NextRequest): boolean {
  return (
    request.nextUrl.searchParams.has("pin") ||
    request.headers.has("x-share-pin") ||
    request.headers.has("x-eh-share-pin")
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
  if (containsPinMaterial(request)) {
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  const { token, documentId } = await context.params;
  if (!DocumentId.safeParse(documentId).success) {
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  try {
    await loadShareByToken(token);
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
    const authorized = await authorizeShareRead({
      token,
      cookieHeader: request.headers.get("cookie"),
      resource: { kind: "document", documentId },
      clientClass: boundary.clientClass,
      beforeAllowedBytes: async (lookup) =>
        (await getOwnedDocument(lookup.share.profile_id, documentId)) !== null,
    });
    const documentRow = await getOwnedDocument(
      authorized.lookup.share.profile_id,
      documentId,
    );
    if (!documentRow) throw new ShareUnavailableError();
    const storagePath = getOriginalPath(documentRow);
    const { data, error } = await createAdminClient()
      .storage.from(LAB_DOCUMENTS_BUCKET)
      .download(storagePath);
    if (error || !data) throw new ShareServiceError();

    const headers = new Headers({
      "Content-Type": guessMimeType(
        documentRow.original_filename,
        documentRow.mime_type,
      ),
      "Content-Disposition": `attachment; filename="${safeFilename(documentRow.original_filename)}"`,
      "Content-Length": String(data.size),
    });
    const response = new Response(data, { status: 200, headers });
    applyPublicShareResponsePolicy(response);
    return response;
  } catch (error) {
    if (
      error instanceof ShareUnavailableError ||
      error instanceof ShareServiceError
    ) {
      return publicShareError(error);
    }
    return publicShareError(new ShareServiceError());
  }
}
