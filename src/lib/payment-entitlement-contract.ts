export const ENTITLEMENT_HEADER = "X-EasyHealth-Entitlement";

export type EntitlementRetryResponse = {
  error: string;
  message?: string;
  entitlement_id?: string;
  retry_without_payment?: boolean;
};

export function parseEntitlementRetryResponse(body: unknown): {
  error: string;
  message?: string;
  entitlementId: string | null;
  retryWithoutPayment: boolean;
} {
  const data =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const error = typeof data.error === "string" ? data.error : "Request failed";
  const message = typeof data.message === "string" ? data.message : undefined;
  const entitlementId =
    typeof data.entitlement_id === "string" && data.entitlement_id.trim()
      ? data.entitlement_id
      : null;
  const retryWithoutPayment = data.retry_without_payment === true;

  return { error, message, entitlementId, retryWithoutPayment };
}
