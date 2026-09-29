import { NextRequest } from "next/server";
import { z } from "zod";
import { createSharePinProof } from "@/lib/share-links/repository";
import {
  loadShareByToken,
  recordShareOutcome,
  ShareServiceError,
} from "@/lib/share-links/authorization";
import {
  generatePinProof,
  pinProofTtlSeconds,
  SHARE_PIN_COOKIE,
  verifySharePin,
} from "@/lib/share-links/pin";
import { shareTokenDigestKey } from "@/lib/share-links/rate-limit";
import {
  consumeFailureRateLimit,
  verifyPublicBoundary,
} from "@/lib/share-links/public-boundary";
import {
  publicShareError,
  publicShareJson,
} from "@/lib/share-links/route-responses";
type RouteContext = { params: Promise<{ token: string }> };

const PinBodySchema = z.object({ pin: z.string() }).strict();

function invalidPinRequest() {
  return publicShareJson({ error: "PIN request is invalid" }, 400);
}

function containsPinOutsideBody(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.has("pin")) return true;
  if (
    request.headers.has("x-share-pin") ||
    request.headers.has("x-eh-share-pin") ||
    request.headers.has("authorization")
  ) {
    return true;
  }
  return /(?:^|;\s*)pin=/i.test(request.headers.get("cookie") ?? "");
}

export async function POST(request: NextRequest, context: RouteContext) {
  const boundary = verifyPublicBoundary(request);
  if (boundary instanceof Response) return boundary;
  if (containsPinOutsideBody(request)) return invalidPinRequest();

  const { token } = await context.params;
  let lookup;
  try {
    lookup = await loadShareByToken(token);
  } catch (error) {
    const limited = await consumeFailureRateLimit({
      tokenKey: null,
      boundary,
    });
    if (limited) return limited;
    return publicShareError(error);
  }

  if (lookup.share.pin_hash === null || lookup.share.pin_salt === null) {
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  const now = new Date();
  if (
    lookup.share.revoked_at !== null ||
    new Date(lookup.share.expires_at) <= now
  ) {
    try {
      await recordShareOutcome(
        lookup.share,
        "pin",
        lookup.share.revoked_at !== null ? "revoked" : "expired",
        boundary.clientClass,
      );
    } catch {
      return publicShareError(new ShareServiceError());
    }
    let tokenKey: string;
    try {
      tokenKey = shareTokenDigestKey(lookup.token.tokenDigest);
    } catch (rateError) {
      return publicShareError(rateError);
    }
    const limited = await consumeFailureRateLimit({ tokenKey, boundary });
    if (limited) {
      try {
        await recordShareOutcome(
          lookup.share,
          "pin",
          "rate_limited",
          boundary.clientClass,
        );
      } catch {
        return publicShareError(new ShareServiceError());
      }
      return limited;
    }
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8_192) return invalidPinRequest();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidPinRequest();
  }
  const parsed = PinBodySchema.safeParse(body);
  if (!parsed.success) return invalidPinRequest();

  let validPin = false;
  try {
    validPin = await verifySharePin(
      parsed.data.pin,
      lookup.share.pin_hash,
      lookup.share.pin_salt,
    );
  } catch {
    return publicShareError(new ShareServiceError());
  }
  if (!validPin) {
    try {
      await recordShareOutcome(
        lookup.share,
        "pin",
        "pin_invalid",
        boundary.clientClass,
      );
    } catch {
      return publicShareError(new ShareServiceError());
    }
    let tokenKey: string;
    try {
      tokenKey = shareTokenDigestKey(lookup.token.tokenDigest);
    } catch (rateError) {
      return publicShareError(rateError);
    }
    const limited = await consumeFailureRateLimit({ tokenKey, boundary });
    if (limited) {
      try {
        await recordShareOutcome(
          lookup.share,
          "pin",
          "rate_limited",
          boundary.clientClass,
        );
      } catch {
        return publicShareError(new ShareServiceError());
      }
      return limited;
    }
    return publicShareJson({ error: "PIN required" }, 401);
  }

  try {
    const ttlSeconds = pinProofTtlSeconds();
    const proof = generatePinProof();
    await createSharePinProof({
      shareId: lookup.share.share_id,
      proofDigest: proof.proofDigest,
      expiresAt: new Date(now.getTime() + ttlSeconds * 1_000),
    });
    await recordShareOutcome(
      lookup.share,
      "pin",
      "allowed",
      boundary.clientClass,
    );
    const response = publicShareJson({ ok: true });
    response.cookies.set({
      name: SHARE_PIN_COOKIE,
      value: proof.proof,
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: ttlSeconds,
    });
    return response;
  } catch {
    return publicShareError(new ShareServiceError());
  }
}
