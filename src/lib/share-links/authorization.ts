import {
  InvalidShareTokenError,
  digestShareToken,
  type ShareTokenDigest,
} from "./tokens";
import {
  readReportShareByDigest,
  readSharePinProof,
  touchReportShareLastAccessed,
  writeReportShareAccessEvent,
  type ShareAccessResource,
  type ShareClientClass,
  type ShareRow,
} from "./repository";
import { proofDigest, SHARE_PIN_COOKIE } from "./pin";
import { resolveReportRead, type ReportReadResult } from "@/lib/report-read";

export class ShareUnavailableError extends Error {
  readonly clearCookie: boolean;

  constructor(clearCookie = false) {
    super("Share unavailable");
    this.name = "ShareUnavailableError";
    this.clearCookie = clearCookie;
  }
}

export class SharePinRequiredError extends Error {
  readonly clearCookie: boolean;

  constructor(clearCookie: boolean) {
    super("Share PIN required");
    this.name = "SharePinRequiredError";
    this.clearCookie = clearCookie;
  }
}

export class ShareServiceError extends Error {
  constructor() {
    super("Share service unavailable");
    this.name = "ShareServiceError";
  }
}

export type ShareLookup = Readonly<{
  share: ShareRow;
  token: ShareTokenDigest;
}>;

export type ShareResource =
  | Readonly<{ kind: "page" | "report" }>
  | Readonly<{ kind: "export"; format: string }>
  | Readonly<{ kind: "document"; documentId: string }>;

export type AuthorizedShareRead = Readonly<{
  lookup: ShareLookup;
  reportRead: Extract<ReportReadResult, { status: "structured" }>;
}>;

function isActive(share: ShareRow, now: Date): boolean {
  return (
    share.revoked_at === null &&
    new Date(share.expires_at).getTime() > now.getTime()
  );
}

export async function recordShareOutcome(
  share: ShareRow,
  resource: ShareAccessResource,
  result: Extract<
    Parameters<typeof writeReportShareAccessEvent>[0]["result"],
    string
  >,
  clientClass: ShareClientClass,
): Promise<void> {
  try {
    await writeReportShareAccessEvent({
      shareId: share.share_id,
      result,
      resourceKind: resource,
      clientClass,
    });
  } catch {
    throw new ShareServiceError();
  }
}

export async function loadShareByToken(token: string): Promise<ShareLookup> {
  let tokenDigest: ShareTokenDigest;
  try {
    tokenDigest = digestShareToken(token);
  } catch (error) {
    if (error instanceof InvalidShareTokenError)
      throw new ShareUnavailableError();
    throw new ShareServiceError();
  }

  let share: ShareRow | null;
  try {
    share = await readReportShareByDigest(tokenDigest.tokenDigest);
  } catch {
    throw new ShareServiceError();
  }
  if (!share || share.token_key_version !== tokenDigest.tokenKeyVersion) {
    throw new ShareUnavailableError();
  }
  return { share, token: tokenDigest };
}

function cookieProof(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const pair = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SHARE_PIN_COOKIE}=`));
  if (!pair) return null;
  const value = pair.slice(SHARE_PIN_COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43,512}$/.test(value) ? value : null;
}

export async function requireSharePinProof(
  lookup: ShareLookup,
  cookieHeader: string | null,
  now: Date,
): Promise<boolean> {
  if (lookup.share.pin_hash === null) return true;
  const proof = cookieProof(cookieHeader);
  if (!proof) return false;
  let digest: string;
  try {
    digest = proofDigest(proof);
  } catch {
    throw new ShareServiceError();
  }
  const proofRow = await readSharePinProof({
    shareId: lookup.share.share_id,
    proofDigest: digest,
    now,
  });
  if (!proofRow) return false;
  const currentShare = await readReportShareByDigest(lookup.token.tokenDigest);
  return (
    currentShare !== null &&
    currentShare.share_id === lookup.share.share_id &&
    currentShare.token_key_version === lookup.token.tokenKeyVersion &&
    isActive(currentShare, now) &&
    new Date(proofRow.expires_at).getTime() > now.getTime()
  );
}

export async function authorizeShareRead(
  input: Readonly<{
    token: string;
    cookieHeader: string | null;
    resource: ShareResource;
    clientClass: ShareClientClass;
    now?: Date;
    beforeAllowedBytes?: (lookup: ShareLookup) => Promise<boolean>;
  }>,
): Promise<AuthorizedShareRead> {
  const now = input.now ?? new Date();
  const lookup = await loadShareByToken(input.token);
  const resourceKind: ShareAccessResource = input.resource.kind;

  if (lookup.share.revoked_at !== null) {
    await recordShareOutcome(
      lookup.share,
      resourceKind,
      "revoked",
      input.clientClass,
    );
    throw new ShareUnavailableError(
      lookup.share.pin_hash !== null && input.cookieHeader !== null,
    );
  }
  if (new Date(lookup.share.expires_at).getTime() <= now.getTime()) {
    await recordShareOutcome(
      lookup.share,
      resourceKind,
      "expired",
      input.clientClass,
    );
    throw new ShareUnavailableError(
      lookup.share.pin_hash !== null && input.cookieHeader !== null,
    );
  }

  let hasProof: boolean;
  try {
    hasProof = await requireSharePinProof(lookup, input.cookieHeader, now);
  } catch (error) {
    if (error instanceof ShareServiceError) throw error;
    throw new ShareServiceError();
  }
  if (!hasProof) {
    await recordShareOutcome(
      lookup.share,
      resourceKind,
      "pin_required",
      input.clientClass,
    );
    throw new SharePinRequiredError(input.cookieHeader !== null);
  }

  if (input.resource.kind === "export") {
    if (
      lookup.share.download_policy === "none" ||
      !lookup.share.allowed_export_formats.includes(input.resource.format)
    ) {
      await recordShareOutcome(
        lookup.share,
        "export",
        "denied",
        input.clientClass,
      );
      throw new ShareUnavailableError();
    }
  }
  if (input.resource.kind === "document") {
    if (
      lookup.share.download_policy !== "documents" ||
      !lookup.share.document_ids.includes(input.resource.documentId)
    ) {
      await recordShareOutcome(
        lookup.share,
        "document",
        "denied",
        input.clientClass,
      );
      throw new ShareUnavailableError();
    }
  }

  let reportRead: ReportReadResult;
  try {
    reportRead = await resolveReportRead({
      profileId: lookup.share.profile_id,
      reportId: lookup.share.report_id,
      mode: input.resource.kind === "export" ? "export" : "share",
    });
  } catch {
    await recordShareOutcome(
      lookup.share,
      resourceKind,
      "unavailable",
      input.clientClass,
    );
    throw new ShareServiceError();
  }
  if (reportRead.status !== "structured") {
    await recordShareOutcome(
      lookup.share,
      resourceKind,
      "unavailable",
      input.clientClass,
    );
    throw new ShareUnavailableError();
  }

  if (input.beforeAllowedBytes) {
    let allowed = false;
    try {
      allowed = await input.beforeAllowedBytes(lookup);
    } catch {
      await recordShareOutcome(
        lookup.share,
        resourceKind,
        "unavailable",
        input.clientClass,
      );
      throw new ShareServiceError();
    }
    if (!allowed) {
      await recordShareOutcome(
        lookup.share,
        resourceKind,
        "unavailable",
        input.clientClass,
      );
      throw new ShareUnavailableError();
    }
  }

  try {
    await touchReportShareLastAccessed(lookup.share.share_id, now);
    await recordShareOutcome(
      lookup.share,
      resourceKind,
      "allowed",
      input.clientClass,
    );
  } catch {
    throw new ShareServiceError();
  }
  return { lookup, reportRead };
}
export function sharePinCookieValue(
  cookieHeader: string | null,
): string | null {
  return cookieProof(cookieHeader);
}
