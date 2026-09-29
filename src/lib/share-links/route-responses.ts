import { NextResponse } from "next/server";
import {
  SharePinRequiredError,
  ShareServiceError,
  ShareUnavailableError,
} from "./authorization";
import {
  ShareRateLimitConfigurationError,
  ShareRateLimitStoreError,
} from "./rate-limit";
import { applyPublicShareResponsePolicy } from "./public-response-policy";
import { SHARE_PIN_COOKIE } from "./pin";

export const SHARE_ERROR_MESSAGES = {
  unavailable: "Share unavailable",
  pinRequired: "PIN required",
  rateLimited: "Try again later",
  serviceUnavailable: "Share service unavailable",
} as const;

export function publicShareJson(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  applyPublicShareResponsePolicy(response);
  return response;
}

export function clearSharePinCookie(response: NextResponse): void {
  response.cookies.set({
    name: SHARE_PIN_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function publicShareError(
  error: unknown,
  options: Readonly<{ clearPinCookie?: boolean }> = {},
): NextResponse {
  let response: NextResponse;
  if (error instanceof SharePinRequiredError) {
    response = publicShareJson(
      { error: SHARE_ERROR_MESSAGES.pinRequired },
      401,
    );
    if (error.clearCookie || options.clearPinCookie)
      clearSharePinCookie(response);
    return response;
  }
  if (error instanceof ShareUnavailableError) {
    response = publicShareJson(
      { error: SHARE_ERROR_MESSAGES.unavailable },
      404,
    );
    if (error.clearCookie || options.clearPinCookie)
      clearSharePinCookie(response);
    return response;
  }
  if (
    error instanceof ShareRateLimitConfigurationError ||
    error instanceof ShareRateLimitStoreError ||
    error instanceof ShareServiceError
  ) {
    return publicShareJson(
      { error: SHARE_ERROR_MESSAGES.serviceUnavailable },
      503,
    );
  }
  return publicShareJson(
    { error: SHARE_ERROR_MESSAGES.serviceUnavailable },
    503,
  );
}

export function publicShareRateLimited(): NextResponse {
  return publicShareJson({ error: SHARE_ERROR_MESSAGES.rateLimited }, 429);
}
