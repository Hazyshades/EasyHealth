import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureLabDocumentsBucket } from "@/lib/supabase/storage";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import {
  isUploadableDocumentType,
  normalizeDocumentType,
  resolveFileKind,
} from "@/lib/health-systems";
import {
  exchangeStorageUploadTicket,
  issueStorageUploadTicket,
  uploadToSignedStorageUrl,
  verifyAndCompleteStorageIntent,
} from "@/lib/documents/upload-broker";
import { enqueueFullPipelineJob } from "@/lib/documents/jobs";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
]);

export async function POST(req: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const documentTypeRaw = formData.get("document_type");
  const normalizedType =
    typeof documentTypeRaw === "string"
      ? normalizeDocumentType(documentTypeRaw)
      : null;

  if (normalizedType === "dicom") {
    return NextResponse.json(
      { error: "DICOM upload is not available yet" },
      { status: 400 },
    );
  }

  const documentType =
    normalizedType && isUploadableDocumentType(normalizedType)
      ? normalizedType
      : "lab_result";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024 || file.size <= 0) {
    return NextResponse.json(
      { error: "File size must be between 1 byte and 10MB" },
      { status: 400 },
    );
  }

  const filenameMimeType = file.name.match(/\.pdf$/i)
    ? "application/pdf"
    : file.name.match(/\.jpe?g$/i)
      ? "image/jpeg"
      : file.name.match(/\.png$/i)
        ? "image/png"
        : null;
  const mimeType = ALLOWED_TYPES.has(file.type)
    ? file.type === "image/jpg"
      ? "image/jpeg"
      : file.type
    : (filenameMimeType ?? file.type);
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: "Only PDF, JPEG, and PNG are supported" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  try {
    await ensureLabDocumentsBucket(supabase);
  } catch {
    return NextResponse.json(
      { error: "Storage setup failed" },
      { status: 500 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentSha256 = createHash("sha256").update(buffer).digest("hex");
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 10) || "bin";
  const fileKind = resolveFileKind(mimeType, file.name);

  const { data: reservationRows, error: reservationError } = await supabase.rpc(
    "create_document_upload_reservation",
    {
      p_profile_id: profileId,
      p_original_filename: file.name,
      p_mime_type: mimeType,
      p_file_size_bytes: file.size,
      p_content_sha256: contentSha256,
      p_document_type: documentType,
      p_file_kind: fileKind,
      p_extension: extension,
    },
  );
  const reservation = Array.isArray(reservationRows)
    ? reservationRows[0]
    : null;
  if (reservationError || !reservation) {
    return NextResponse.json(
      { error: "Upload reservation failed" },
      { status: 500 },
    );
  }

  const documentId = String(reservation.document_id);
  const intentId = String(reservation.intent_id);
  try {
    const issued = await issueStorageUploadTicket(supabase, {
      intentId,
      profileId,
      writeGeneration: Number(reservation.write_generation),
    });
    const exchanged = await exchangeStorageUploadTicket(
      supabase,
      intentId,
      issued.ticket,
    );
    await uploadToSignedStorageUrl(exchanged.signed_url, buffer, mimeType);
    await verifyAndCompleteStorageIntent(supabase, intentId, issued.ticket);
    await enqueueFullPipelineJob(profileId, documentId);
  } catch {
    await supabase.rpc("fail_storage_write_intent", {
      p_intent_id: intentId,
      p_reason_code: "owner_upload_failed",
    });
    return NextResponse.json(
      { error: "Upload processing failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    documentId,
    processingStatus: "processing",
    disclaimer: MEDICAL_DISCLAIMER,
  });
}

export const maxDuration = 60;
