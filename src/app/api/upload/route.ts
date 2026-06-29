import { NextRequest, NextResponse } from "next/server";
import { withGateway } from "@/lib/x402";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureLabDocumentsBucket, LAB_DOCUMENTS_BUCKET } from "@/lib/supabase/storage";
import { extractBiomarkersFromFile } from "@/lib/extract-biomarkers";
import { upsertObservations } from "@/lib/upsert-observations";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import { isDocumentType } from "@/lib/health-systems";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

async function handler(req: NextRequest, _payment: import("@/lib/x402").SettledPayment) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const documentTypeRaw = formData.get("document_type");
  const documentType =
    typeof documentTypeRaw === "string" && isDocumentType(documentTypeRaw)
      ? documentTypeRaw
      : "lab";

  if (documentType === "dicom") {
    return NextResponse.json({ error: "DICOM upload is not available yet" }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_TYPES.has(mimeType) && !file.name.match(/\.(pdf|jpe?g|png)$/i)) {
    return NextResponse.json({ error: "Only PDF, JPEG, and PNG are supported" }, { status: 400 });
  }

  const supabase = createAdminClient();
  try {
    await ensureLabDocumentsBucket(supabase);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Storage setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `${profileId}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(LAB_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload processing failed", message: uploadError.message },
      { status: 500 }
    );
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      profile_id: profileId,
      storage_path: storagePath,
      original_filename: file.name,
      document_type: documentType,
      status: "processing",
    })
    .select("id")
    .single();

  if (docError) {
    return NextResponse.json(
      { error: "Upload processing failed", message: docError.message },
      { status: 500 }
    );
  }

  try {
    const extraction = await extractBiomarkersFromFile(buffer, mimeType, file.name, {
      profileId,
    });

    if (extraction.biomarkers.length === 0) {
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "No biomarkers found" })
        .eq("id", document.id);
      return NextResponse.json({ error: "No biomarkers found in document" }, { status: 422 });
    }

    const observedAt = await upsertObservations(profileId, document.id, extraction);

    await supabase
      .from("documents")
      .update({
        status: "completed",
        lab_name: extraction.lab_name,
        observed_at: observedAt,
      })
      .eq("id", document.id);

    return NextResponse.json({
      documentId: document.id,
      biomarkers: extraction.biomarkers,
      observedAt,
      disclaimer: MEDICAL_DISCLAIMER,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    await supabase
      .from("documents")
      .update({ status: "failed", error_message: message })
      .eq("id", document.id);
    return NextResponse.json({ error: "Upload processing failed", message }, { status: 500 });
  }
}

export const POST = withGateway(handler, "$0.01", "/api/upload", {
  getProfileId: getSessionProfileId,
});

export const maxDuration = 60;
