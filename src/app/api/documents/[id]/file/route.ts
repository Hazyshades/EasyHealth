import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  assertDocumentOwner,
  createSignedStorageUrl,
  getOriginalPath,
  guessMimeType,
  noStoreJson,
} from "@/lib/documents/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const storagePath = getOriginalPath(doc!);
  const signed = await createSignedStorageUrl(storagePath);
  if (!signed) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  return noStoreJson({
    url: signed.url,
    mimeType: guessMimeType(doc!.original_filename, doc!.mime_type),
    filename: doc!.original_filename,
    expiresIn: signed.expiresIn,
  });
}
