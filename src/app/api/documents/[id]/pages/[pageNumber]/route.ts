import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner, createSignedStorageUrl, noStoreJson } from "@/lib/documents/access";

type RouteContext = { params: Promise<{ id: string; pageNumber: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, pageNumber: pageNumberRaw } = await context.params;
  const pageNumber = Number.parseInt(pageNumberRaw, 10);
  if (!Number.isFinite(pageNumber) || pageNumber < 1) {
    return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
  }

  const { doc, error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const { data: page, error: pageError } = await supabase
    .from("document_pages")
    .select("preview_storage_path, width, height, page_number")
    .eq("document_id", id)
    .eq("page_number", pageNumber)
    .maybeSingle();

  if (pageError) {
    return NextResponse.json({ error: pageError.message }, { status: 500 });
  }
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }

  const signed = await createSignedStorageUrl(page.preview_storage_path);
  if (!signed) {
    return NextResponse.json({ error: "Page preview not available" }, { status: 404 });
  }

  return noStoreJson({
    url: signed.url,
    pageNumber: page.page_number,
    width: page.width,
    height: page.height,
    expiresIn: signed.expiresIn,
  });
}
