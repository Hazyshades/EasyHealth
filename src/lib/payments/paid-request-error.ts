"use client";

import {
  ENTITLEMENT_HEADER,
  parseEntitlementRetryResponse,
} from "@/lib/payment-entitlement-contract";

export class PaidRequestFailedError extends Error {
  readonly entitlementId: string | null;
  readonly retryWithoutPayment: boolean;
  readonly errorCode: string;

  constructor(
    message: string,
    options: {
      entitlementId?: string | null;
      retryWithoutPayment?: boolean;
      errorCode?: string;
    } = {}
  ) {
    super(message);
    this.name = "PaidRequestFailedError";
    this.entitlementId = options.entitlementId ?? null;
    this.retryWithoutPayment = options.retryWithoutPayment ?? false;
    this.errorCode = options.errorCode ?? "Request failed";
  }
}

export function isPaidRequestFailedError(error: unknown): error is PaidRequestFailedError {
  return error instanceof PaidRequestFailedError;
}

export { ENTITLEMENT_HEADER, parseEntitlementRetryResponse };
