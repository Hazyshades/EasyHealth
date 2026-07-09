import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner, createSignedStorageUrl, noStoreJson } from "@/lib/documents/access";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  if (!doc!.thumbnail_storage_path) {
    return NextResponse.json({ error: "Thumbnail not available" }, { status: 404 });
  }

  const signed = await createSignedStorageUrl(doc!.thumbnail_storage_path);
  if (!signed) {
    return NextResponse.json({ error: "Thumbnail not available" }, { status: 404 });
  }

  return noStoreJson({
    url: signed.url,
    expiresIn: signed.expiresIn,
  });
}
