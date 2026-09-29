import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordShareOutcome,
  ShareServiceError,
  type ShareLookup,
} from "./authorization";
import { requireTrustedIngress } from "./trusted-ingress";
import {
  classifyShareUserAgent,
  consumeShareFailureRateLimits,
  shareTokenDigestKey,
} from "./rate-limit";
import type { ShareAccessResource, ShareAccessResult } from "./repository";
import {
  publicShareError,
  publicShareJson,
  publicShareRateLimited,
} from "./route-responses";

export type PublicBoundaryContext = Readonly<{
  clientAddress: string;
  clientClass: "browser" | "automation" | "other" | "unknown";
  userAgent: string | null;
}>;

export function verifyPublicBoundary(
  request: NextRequest,
): PublicBoundaryContext | NextResponse {
  const ingress = requireTrustedIngress(request);
  if (!ingress.ok) {
    return publicShareJson({ error: "Share service unavailable" }, 503);
  }
  const userAgent = request.headers.get("user-agent");
  return {
    clientAddress: ingress.context.edgeVerifiedClientAddress,
    clientClass: classifyShareUserAgent(userAgent),
    userAgent,
  };
}

export async function consumeFailureRateLimit(
  input: Readonly<{
    tokenKey: string | null;
    boundary: PublicBoundaryContext;
  }>,
): Promise<NextResponse | null> {
  try {
    const result = await consumeShareFailureRateLimits(createAdminClient(), {
      tokenKey: input.tokenKey,
      requesterAddress: input.boundary.clientAddress,
      userAgent: input.boundary.userAgent,
    });
    return result.allowed ? null : publicShareRateLimited();
  } catch (error) {
    return publicShareError(error);
  }
}

type SelectedShareFailureInput = Readonly<{
  lookup: ShareLookup;
  boundary: PublicBoundaryContext;
  resourceKind: ShareAccessResource;
}>;

export async function consumeSelectedShareFailureRateLimit(
  input: SelectedShareFailureInput,
): Promise<NextResponse | null> {
  let tokenKey: string;
  try {
    tokenKey = shareTokenDigestKey(input.lookup.token.tokenDigest);
  } catch (error) {
    return publicShareError(error);
  }
  const limited = await consumeFailureRateLimit({
    tokenKey,
    boundary: input.boundary,
  });
  if (!limited) return null;
  try {
    await recordShareOutcome(
      input.lookup.share,
      input.resourceKind,
      "rate_limited",
      input.boundary.clientClass,
    );
  } catch {
    return publicShareError(new ShareServiceError());
  }
  return limited;
}

export async function recordAndConsumeSelectedShareFailure(
  input: SelectedShareFailureInput & Readonly<{ result: ShareAccessResult }>,
): Promise<NextResponse | null> {
  try {
    await recordShareOutcome(
      input.lookup.share,
      input.resourceKind,
      input.result,
      input.boundary.clientClass,
    );
  } catch {
    return publicShareError(new ShareServiceError());
  }
  return consumeSelectedShareFailureRateLimit(input);
}
