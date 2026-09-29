import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const Uuid = z.string().uuid();
const HexDigest = z.string().regex(/^[0-9a-f]{64}$/);

const ShareRowSchema = z.object({
  share_id: Uuid,
  profile_id: Uuid,
  report_id: Uuid,
  token_key_version: z.string(),
  pin_hash: z.string().nullable(),
  pin_salt: z.string().nullable(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  download_policy: z.enum(["none", "report", "documents"]),
  allowed_export_formats: z.array(z.string()),
  document_ids: z.array(Uuid),
  last_accessed_at: z.string().nullable(),
});

const ShareCreationSchema = z.object({
  share_id: Uuid,
  expires_at: z.string(),
  download_policy: z.enum(["none", "report", "documents"]),
  allowed_export_formats: z.array(z.string()),
});

const PinProofSchema = z.object({
  proof_id: Uuid,
  share_id: Uuid,
  expires_at: z.string(),
});

const PinProofCreationSchema = z.object({
  proof_id: Uuid,
  expires_at: z.string(),
});

export type ShareRow = z.infer<typeof ShareRowSchema>;
export type ShareCreation = z.infer<typeof ShareCreationSchema>;

export type ShareAccessResource =
  | "page"
  | "report"
  | "export"
  | "document"
  | "pin";
export type ShareAccessResult =
  | "allowed"
  | "denied"
  | "expired"
  | "revoked"
  | "pin_required"
  | "pin_invalid"
  | "rate_limited"
  | "unavailable";
export type ShareClientClass = "browser" | "automation" | "other" | "unknown";

export class ShareRepositoryError extends Error {
  constructor() {
    super("Share persistence unavailable");
    this.name = "ShareRepositoryError";
  }
}

function retentionDays(): number {
  const raw = process.env.SHARE_ACCESS_EVENT_RETENTION_DAYS?.trim();
  const value = raw === undefined ? 30 : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 90) {
    throw new ShareRepositoryError();
  }
  return value;
}

function parseRpc<T>(schema: z.ZodType<T>, data: unknown): T {
  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = schema.safeParse(candidate);
  if (!parsed.success) throw new ShareRepositoryError();
  return parsed.data;
}

export async function createReportShare(
  input: Readonly<{
    profileId: string;
    reportId: string;
    tokenDigest: string;
    tokenKeyVersion: string;
    pinHash: string | null;
    pinSalt: string | null;
    expiresAt: Date;
    downloadPolicy: "none" | "report" | "documents";
    allowedExportFormats: readonly string[];
    documentIds: readonly string[];
  }>,
): Promise<ShareCreation> {
  if (!HexDigest.safeParse(input.tokenDigest).success) {
    throw new ShareRepositoryError();
  }
  const { data, error } = await createAdminClient().rpc("create_report_share", {
    p_profile_id: input.profileId,
    p_report_id: input.reportId,
    p_token_digest: input.tokenDigest,
    p_token_key_version: input.tokenKeyVersion,
    p_pin_hash: input.pinHash,
    p_pin_salt: input.pinSalt,
    p_expires_at: input.expiresAt.toISOString(),
    p_download_policy: input.downloadPolicy,
    p_allowed_export_formats: [...input.allowedExportFormats],
    p_document_ids: [...input.documentIds],
  });
  if (error) throw new ShareRepositoryError();
  return parseRpc(ShareCreationSchema, data);
}

export async function readReportShareByDigest(
  tokenDigest: string,
): Promise<ShareRow | null> {
  if (!HexDigest.safeParse(tokenDigest).success) return null;
  const { data, error } = await createAdminClient()
    .rpc("read_report_share_by_digest", { p_token_digest: tokenDigest })
    .maybeSingle();
  if (error) throw new ShareRepositoryError();
  if (data === null) return null;
  return ShareRowSchema.parse(data);
}

export async function touchReportShareLastAccessed(
  shareId: string,
  observedAt = new Date(),
): Promise<string> {
  const { data, error } = await createAdminClient().rpc(
    "touch_report_share_last_accessed",
    { p_share_id: shareId, p_observed_at: observedAt.toISOString() },
  );
  if (error) throw new ShareRepositoryError();
  const row = parseRpc(
    z.object({ share_id: Uuid, last_accessed_at: z.string() }),
    data,
  );
  return row.last_accessed_at;
}

export async function writeReportShareAccessEvent(
  input: Readonly<{
    shareId: string;
    occurredAt?: Date;
    result: ShareAccessResult;
    resourceKind: ShareAccessResource;
    clientClass: ShareClientClass;
  }>,
): Promise<string> {
  const { data, error } = await createAdminClient().rpc(
    "write_report_share_access_event",
    {
      p_share_id: input.shareId,
      p_occurred_at: (input.occurredAt ?? new Date()).toISOString(),
      p_result: input.result,
      p_resource_kind: input.resourceKind,
      p_client_class: input.clientClass,
      p_retention_days: retentionDays(),
    },
  );
  if (error || typeof data !== "string" || !Uuid.safeParse(data).success) {
    throw new ShareRepositoryError();
  }
  return data;
}

export async function createSharePinProof(
  input: Readonly<{
    shareId: string;
    proofDigest: string;
    expiresAt: Date;
  }>,
): Promise<{ proofId: string; expiresAt: string }> {
  if (!HexDigest.safeParse(input.proofDigest).success) {
    throw new ShareRepositoryError();
  }
  const { data, error } = await createAdminClient().rpc(
    "create_report_share_pin_proof",
    {
      p_share_id: input.shareId,
      p_proof_digest: input.proofDigest,
      p_expires_at: input.expiresAt.toISOString(),
    },
  );
  if (error) throw new ShareRepositoryError();
  const row = parseRpc(PinProofCreationSchema, data);
  return { proofId: row.proof_id, expiresAt: row.expires_at };
}

export async function readSharePinProof(
  input: Readonly<{
    shareId: string;
    proofDigest: string;
    now?: Date;
  }>,
): Promise<z.infer<typeof PinProofSchema> | null> {
  if (!HexDigest.safeParse(input.proofDigest).success) return null;
  const { data, error } = await createAdminClient()
    .rpc("read_report_share_pin_proof", {
      p_share_id: input.shareId,
      p_proof_digest: input.proofDigest,
      p_now: (input.now ?? new Date()).toISOString(),
    })
    .maybeSingle();
  if (error) throw new ShareRepositoryError();
  if (data === null) return null;
  return PinProofSchema.parse(data);
}
