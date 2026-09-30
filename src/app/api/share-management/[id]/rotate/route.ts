import { z } from "zod";

import { getSessionProfileId } from "@/lib/auth/session";
import { env } from "@/lib/env";
import { noStoreJson } from "@/lib/documents/access";
import {
  probeOwnedShareReplacement,
  replaceOwnedShare,
  ShareManagementError,
} from "@/lib/share-management/repository";
import {
  generateShareToken,
  ShareTokenConfigurationError,
} from "@/lib/share-links/tokens";
import { isShareIdempotencyKey } from "@/lib/share-management/tokens";

type RouteContext = { params: Promise<{ id: string }> };

const replacementRequestSchema = z.object({
  idempotency_key: z.string(),
});

function replacementError(error: unknown) {
  if (error instanceof ShareManagementError) {
    if (error.status === 404) {
      return noStoreJson({ error: "Share not found" }, { status: 404 });
    }
    if (error.status === 409) {
      return noStoreJson(
        { error: "Share has already changed" },
        { status: 409 },
      );
    }
  }
  if (error instanceof ShareTokenConfigurationError) {
    return noStoreJson(
      { error: "Share replacement is unavailable" },
      { status: 503 },
    );
  }
  return noStoreJson(
    { error: "Share replacement is unavailable" },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId)
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return noStoreJson({ error: "Share not found" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsedBody = replacementRequestSchema.safeParse(body);
  if (
    !parsedBody.success ||
    !isShareIdempotencyKey(parsedBody.data.idempotency_key)
  ) {
    return noStoreJson(
      { error: "A valid idempotency key is required" },
      { status: 400 },
    );
  }
  const idempotencyKey = parsedBody.data.idempotency_key;

  try {
    const replay = await probeOwnedShareReplacement({
      profileId,
      predecessorShareId: id,
      idempotencyKey,
    });

    if (replay?.replayed) {
      return noStoreJson({
        status: "already_completed",
        operation_id: replay.operation_id,
        share_id: replay.successor_share_id,
        replayed: true,
      });
    }

    const token = generateShareToken();
    const replacement = await replaceOwnedShare({
      profileId,
      predecessorShareId: id,
      idempotencyKey,
      tokenDigest: token.tokenDigest,
      tokenKeyVersion: token.tokenKeyVersion,
    });

    if (replacement.replayed) {
      return noStoreJson({
        status: "already_completed",
        operation_id: replacement.operation_id,
        share_id: replacement.successor_share_id,
        replayed: true,
      });
    }

    if (!replacement.successor_share_id) {
      return noStoreJson(
        { error: "Share replacement is unavailable" },
        { status: 500 },
      );
    }

    return noStoreJson({
      status: "replaced",
      operation_id: replacement.operation_id,
      share_id: replacement.successor_share_id,
      link: new URL(`/share/${token.token}`, env.URL).toString(),
      replayed: false,
    });
  } catch (error) {
    return replacementError(error);
  }
}
