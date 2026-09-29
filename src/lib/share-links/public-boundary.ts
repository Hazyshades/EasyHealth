import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTrustedIngress } from "./trusted-ingress";
import {
  classifyShareUserAgent,
  consumeShareFailureRateLimits,
} from "./rate-limit";
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
