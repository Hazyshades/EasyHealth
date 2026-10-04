import {
  listOwnerReportShares,
  listOwnerShareAccessEvents,
  probeOwnerReportShareReplacement,
  replaceOwnerReportShare,
  revokeOwnerReportShare,
  type ManagedShare,
} from "@/lib/share-links/management";
import { ShareRepositoryError } from "@/lib/share-links/repository";
import {
  projectOwnerShares,
  type OwnerShare,
  type ShareAccessEventSource,
  type ShareLinkSource,
} from "@/lib/share-management/projection";

export type ReplacementRpcResult = {
  operation_id: string | null;
  successor_share_id: string | null;
  replayed: boolean;
};

export class ShareManagementError extends Error {
  readonly status: 404 | 409 | 500;

  constructor(status: 404 | 409 | 500, code: string) {
    super(code);
    this.name = "ShareManagementError";
    this.status = status;
  }
}

function classifyRpcFailure(message: string): ShareManagementError {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("share_not_found") ||
    normalized.includes("profile_not_found") ||
    normalized.includes("share_not_owned") ||
    normalized.includes("owner_mismatch") ||
    normalized.includes("profile_mismatch") ||
    normalized.includes("not_found")
  ) {
    return new ShareManagementError(404, "share_not_found");
  }
  if (
    normalized.includes("already_revoked") ||
    normalized.includes("share_revoked") ||
    normalized.includes("not_active") ||
    normalized.includes("already_replaced") ||
    normalized.includes("predecessor_revoked") ||
    normalized.includes("share_expired") ||
    normalized.includes("conflict") ||
    normalized.includes("concurrent")
  ) {
    return new ShareManagementError(409, "share_conflict");
  }
  return new ShareManagementError(500, "share_management_unavailable");
}
function managementError(error: unknown): ShareManagementError {
  if (error instanceof ShareManagementError) return error;
  if (error instanceof ShareRepositoryError) {
    return classifyRpcFailure(error.message);
  }
  return new ShareManagementError(500, "share_management_unavailable");
}

function toShareLinkSource(
  profileId: string,
  link: ManagedShare,
): ShareLinkSource {
  return {
    id: link.share_id,
    profile_id: profileId,
    report_id: link.report_id,
    expires_at: link.expires_at,
    revoked_at: link.revoked_at,
    download_policy: link.download_policy,
    allowed_export_formats: link.allowed_export_formats,
    created_at: link.created_at,
    last_accessed_at: link.last_accessed_at,
    reports: { title: link.report_title },
  };
}

export async function listOwnedShares(
  profileId: string,
): Promise<OwnerShare[]> {
  try {
    const links = await listOwnerReportShares(profileId);
    const events = (
      await Promise.all(
        links.map(async (link): Promise<ShareAccessEventSource[]> => {
          const accessEvents = await listOwnerShareAccessEvents(
            profileId,
            link.share_id,
          );
          return accessEvents.map((event) => ({
            share_id: link.share_id,
            occurred_at: event.occurred_at,
            result: event.result,
            resource_kind: event.resource_kind,
            client_class: event.client_class,
            retention_expires_at: event.retention_expires_at,
          }));
        }),
      )
    ).flat();

    return projectOwnerShares(
      profileId,
      links.map((link) => toShareLinkSource(profileId, link)),
      events,
    );
  } catch (error) {
    throw managementError(error);
  }
}

export async function revokeOwnedShare(
  profileId: string,
  shareId: string,
): Promise<void> {
  try {
    await revokeOwnerReportShare(profileId, shareId);
  } catch (error) {
    throw managementError(error);
  }
}

export async function probeOwnedShareReplacement(input: {
  profileId: string;
  predecessorShareId: string;
  idempotencyKey: string;
}): Promise<ReplacementRpcResult | null> {
  try {
    const ownedShares = await listOwnerReportShares(input.profileId);
    if (
      !ownedShares.some((share) => share.share_id === input.predecessorShareId)
    ) {
      throw new ShareManagementError(404, "share_not_found");
    }

    const result = await probeOwnerReportShareReplacement(input);
    return {
      operation_id: result.operation_id,
      successor_share_id: result.successor_share_id,
      replayed: result.replayed,
    };
  } catch (error) {
    if (
      error instanceof ShareRepositoryError &&
      error.message.includes("share_replacement_token_required")
    ) {
      return null;
    }
    throw managementError(error);
  }
}

export async function replaceOwnedShare(input: {
  profileId: string;
  predecessorShareId: string;
  idempotencyKey: string;
  tokenDigest: string;
  tokenKeyVersion: string;
}): Promise<ReplacementRpcResult> {
  try {
    const result = await replaceOwnerReportShare(input);
    return {
      operation_id: result.operation_id,
      successor_share_id: result.successor_share_id,
      replayed: result.replayed,
    };
  } catch (error) {
    throw managementError(error);
  }
}
