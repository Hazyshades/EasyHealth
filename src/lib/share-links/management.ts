import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { ShareRepositoryError } from "./repository";

const Uuid = z.string().uuid();

const ManagedShareSchema = z.object({
  share_id: Uuid,
  report_id: Uuid,
  report_title: z.string().nullable(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  download_policy: z.enum(["none", "report", "documents"]),
  allowed_export_formats: z.array(z.string()),
  document_ids: z.array(Uuid),
  created_at: z.string(),
  last_accessed_at: z.string().nullable(),
});

const AccessEventSchema = z.object({
  event_id: Uuid,
  occurred_at: z.string(),
  result: z.string(),
  resource_kind: z.string(),
  client_class: z.string(),
  retention_expires_at: z.string(),
});

const ReplacementSchema = z.object({
  operation_id: Uuid,
  successor_share_id: Uuid.nullable(),
  operation_status: z.enum(["reserved", "committed"]),
  replayed: z.boolean(),
});

export type ManagedShare = z.infer<typeof ManagedShareSchema>;
export type ManagedShareAccessEvent = z.infer<typeof AccessEventSchema>;
export type ShareReplacementResult = z.infer<typeof ReplacementSchema>;

export async function listOwnerReportShares(
  profileId: string,
  reportId?: string,
): Promise<ManagedShare[]> {
  const { data, error } = await createAdminClient().rpc(
    "list_report_shares_for_owner",
    { p_profile_id: profileId, p_report_id: reportId ?? null },
  );
  if (error) throw new ShareRepositoryError(error.message);
  const parsed = z.array(ManagedShareSchema).safeParse(data);
  if (!parsed.success) throw new ShareRepositoryError();
  return parsed.data;
}

export async function listOwnerShareAccessEvents(
  profileId: string,
  shareId: string,
): Promise<ManagedShareAccessEvent[]> {
  const { data, error } = await createAdminClient().rpc(
    "list_report_share_access_events_for_owner",
    { p_profile_id: profileId, p_share_id: shareId },
  );
  if (error) throw new ShareRepositoryError(error.message);
  const parsed = z.array(AccessEventSchema).safeParse(data);
  if (!parsed.success) throw new ShareRepositoryError();
  return parsed.data;
}

export async function revokeOwnerReportShare(
  profileId: string,
  shareId: string,
): Promise<void> {
  const { error } = await createAdminClient().rpc("revoke_report_share", {
    p_profile_id: profileId,
    p_share_id: shareId,
  });
  if (error) throw new ShareRepositoryError(error.message);
}

type ReplacementInput = Readonly<{
  profileId: string;
  predecessorShareId: string;
  idempotencyKey: string;
  tokenDigest: string | null;
  tokenKeyVersion: string | null;
}>;

function parseReplacementResult(data: unknown): ShareReplacementResult {
  const candidate = Array.isArray(data) ? data[0] : data;
  const parsed = ReplacementSchema.safeParse(candidate);
  if (!parsed.success) throw new ShareRepositoryError();
  return parsed.data;
}

async function callReplaceOwnerReportShare(
  input: ReplacementInput,
): Promise<ShareReplacementResult> {
  const { data, error } = await createAdminClient().rpc(
    "replace_report_share",
    {
      p_profile_id: input.profileId,
      p_predecessor_share_id: input.predecessorShareId,
      p_idempotency_key: input.idempotencyKey,
      p_token_digest: input.tokenDigest,
      p_token_key_version: input.tokenKeyVersion,
    },
  );
  if (error) throw new ShareRepositoryError(error.message);
  return parseReplacementResult(data);
}

export async function probeOwnerReportShareReplacement(
  input: Readonly<{
    profileId: string;
    predecessorShareId: string;
    idempotencyKey: string;
  }>,
): Promise<ShareReplacementResult> {
  return callReplaceOwnerReportShare({
    ...input,
    tokenDigest: null,
    tokenKeyVersion: null,
  });
}

export async function replaceOwnerReportShare(
  input: Readonly<{
    profileId: string;
    predecessorShareId: string;
    idempotencyKey: string;
    tokenDigest: string;
    tokenKeyVersion: string;
  }>,
): Promise<ShareReplacementResult> {
  return callReplaceOwnerReportShare(input);
}
