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
import {
  consumeFailureRateLimit,
  recordAndConsumeSelectedShareFailure,
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

type PinFailureResult = "denied" | "expired" | "revoked" | "pin_invalid";

export async function POST(request: NextRequest, context: RouteContext) {
  const boundary = verifyPublicBoundary(request);
  if (boundary instanceof Response) return boundary;

  const { token } = await context.params;
  if (containsPinOutsideBody(request)) {
    let lookup: Awaited<ReturnType<typeof loadShareByToken>>;
    try {
      lookup = await loadShareByToken(token);
    } catch {
      const limited = await consumeFailureRateLimit({
        tokenKey: null,
        boundary,
      });
      if (limited) return limited;
      return invalidPinRequest();
    }
    const now = new Date();
    const result: PinFailureResult =
      lookup.share.revoked_at !== null
        ? "revoked"
        : new Date(lookup.share.expires_at) <= now
          ? "expired"
          : lookup.share.pin_hash === null || lookup.share.pin_salt === null
            ? "denied"
            : "pin_invalid";
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result,
    });
    if (limited) return limited;
    return invalidPinRequest();
  }

  let lookup: Awaited<ReturnType<typeof loadShareByToken>>;
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
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result: "denied",
    });
    if (limited) return limited;
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  const now = new Date();
  if (
    lookup.share.revoked_at !== null ||
    new Date(lookup.share.expires_at) <= now
  ) {
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result: lookup.share.revoked_at !== null ? "revoked" : "expired",
    });
    if (limited) return limited;
    return publicShareJson({ error: "Share unavailable" }, 404);
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 8_192) {
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result: "pin_invalid",
    });
    if (limited) return limited;
    return invalidPinRequest();
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result: "pin_invalid",
    });
    if (limited) return limited;
    return invalidPinRequest();
  }
  const parsed = PinBodySchema.safeParse(body);
  if (!parsed.success) {
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result: "pin_invalid",
    });
    if (limited) return limited;
    return invalidPinRequest();
  }

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
    const limited = await recordAndConsumeSelectedShareFailure({
      lookup,
      boundary,
      resourceKind: "pin",
      result: "pin_invalid",
    });
    if (limited) return limited;
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
