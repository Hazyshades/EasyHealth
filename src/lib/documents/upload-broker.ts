import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_UPLOAD_TICKET_TTL_SECONDS = 120;

type StorageIntentMetadata = {
  intent_id: string;
  bucket: string;
  object_path: string;
  content_type: string;
  write_generation: number;
  deadline_at: string;
};

type StorageUploadCapability = StorageIntentMetadata & {
  ticket: string;
  ticket_expires_at: string;
  signed_url: string;
};

export function createStorageUploadTicket(): {
  ticket: string;
  ticketHash: string;
  expiresAt: string;
} {
  const ticket = randomBytes(32).toString("hex");
  const ticketHash = createHash("sha256").update(ticket).digest("hex");
  const expiresAt = new Date(
    Date.now() + STORAGE_UPLOAD_TICKET_TTL_SECONDS * 1000,
  ).toISOString();
  return { ticket, ticketHash, expiresAt };
}

export async function issueStorageUploadTicket(
  supabase: SupabaseClient,
  input: {
    intentId: string;
    profileId: string;
    processingAttemptId?: string | null;
    leaseToken?: string | null;
    writeGeneration: number;
  },
): Promise<{
  ticket: string;
  intent: StorageIntentMetadata;
  expiresAt: string;
}> {
  const capability = createStorageUploadTicket();
  const { data, error } = await supabase.rpc("issue_storage_upload_ticket", {
    p_intent_id: input.intentId,
    p_ticket_hash: capability.ticketHash,
    p_expires_at: capability.expiresAt,
    p_profile_id: input.profileId,
    p_processing_attempt_id: input.processingAttemptId ?? null,
    p_lease_token: input.leaseToken ?? null,
    p_write_generation: input.writeGeneration,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error("storage_ticket_issue_failed");
  }
  return {
    ticket: capability.ticket,
    intent: data[0] as StorageIntentMetadata,
    expiresAt: capability.expiresAt,
  };
}

export async function exchangeStorageUploadTicket(
  supabase: SupabaseClient,
  intentId: string,
  ticket: string,
): Promise<StorageUploadCapability> {
  const ticketHash = createHash("sha256").update(ticket).digest("hex");
  const { data, error } = await supabase.rpc("consume_storage_upload_ticket", {
    p_intent_id: intentId,
    p_ticket_hash: ticketHash,
  });
  if (error || !Array.isArray(data) || !data[0]) {
    throw new Error("storage_ticket_exchange_failed");
  }

  const intent = data[0] as StorageIntentMetadata & {
    ticket_expires_at: string;
  };
  const { data: signed, error: signedError } = await supabase.storage
    .from(intent.bucket)
    .createSignedUploadUrl(intent.object_path);
  if (signedError || !signed?.signedUrl) {
    throw new Error("storage_signed_url_failed");
  }

  return {
    ...intent,
    ticket,
    ticket_expires_at: intent.ticket_expires_at,
    signed_url: signed.signedUrl,
  };
}

export async function uploadToSignedStorageUrl(
  signedUrl: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const body = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "content-type": contentType,
      "x-upsert": "false",
    },
    body,
  });
  if (!response.ok) throw new Error("storage_upload_failed");
}

export async function verifyAndCompleteStorageIntent(
  supabase: SupabaseClient,
  intentId: string,
  ticket: string,
): Promise<void> {
  const { data: intent, error: intentError } = await supabase
    .from("document_storage_write_intents")
    .select("document_id, principal_kind, bucket, object_path")
    .eq("id", intentId)
    .maybeSingle();
  if (intentError || !intent) throw new Error("storage_intent_lookup_failed");

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select("content_sha256, file_size_bytes")
    .eq("id", intent.document_id)
    .maybeSingle();
  if (documentError || !document)
    throw new Error("storage_document_lookup_failed");

  const { data: object, error: downloadError } = await supabase.storage
    .from(intent.bucket)
    .download(intent.object_path);
  if (downloadError || !object) {
    throw new Error("storage_object_verification_failed");
  }
  const bytes = Buffer.from(await object.arrayBuffer());
  if (bytes.length === 0) throw new Error("storage_object_verification_failed");
  if (
    intent.principal_kind === "owner" &&
    document.file_size_bytes != null &&
    bytes.length !== Number(document.file_size_bytes)
  ) {
    throw new Error("storage_object_verification_failed");
  }
  if (
    intent.principal_kind === "owner" &&
    document.content_sha256 &&
    createHash("sha256").update(bytes).digest("hex") !== document.content_sha256
  ) {
    throw new Error("storage_object_verification_failed");
  }

  const ticketHash = createHash("sha256").update(ticket).digest("hex");
  const { error: completeError } = await supabase.rpc(
    "complete_storage_write_intent",
    {
      p_intent_id: intentId,
      p_ticket_hash: ticketHash,
      p_object_verified: true,
    },
  );
  if (completeError) throw new Error("storage_intent_completion_failed");
}
