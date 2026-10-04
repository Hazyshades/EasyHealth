import { createHmac, randomUUID } from "node:crypto";

export const SHARE_TEST_TOKEN_KEYS = JSON.stringify({
  "2026-1": "test-share-token-key-2026-1-strong",
  "2025-1": "test-share-token-key-2025-1-strong",
});
export const SHARE_TEST_CURRENT_KEY_VERSION = "2026-1";
export const SHARE_TEST_ATTESTATION_KEY =
  "test-trusted-ingress-attestation-key-strong";
export const SHARE_TEST_RATE_LIMIT_PEPPER =
  "test-rate-limit-pepper-strong-value";
export const SHARE_TEST_PIN_PROOF_PEPPER = "test-pin-proof-pepper-strong-value";

export function configureShareTestEnvironment(): void {
  process.env.SHARE_TOKEN_KEY_RING = SHARE_TEST_TOKEN_KEYS;
  process.env.SHARE_TOKEN_CURRENT_KEY_VERSION = SHARE_TEST_CURRENT_KEY_VERSION;
  process.env.SHARE_TRUSTED_PROXY_CIDRS = "10.0.0.0/8";
  process.env.SHARE_TRUSTED_PROXY_ATTESTATION_KEY = SHARE_TEST_ATTESTATION_KEY;
  process.env.SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS = "30";
  process.env.SHARE_RATE_LIMIT_PEPPER = SHARE_TEST_RATE_LIMIT_PEPPER;
  process.env.SHARE_PIN_PROOF_PEPPER = SHARE_TEST_PIN_PROOF_PEPPER;
  process.env.SHARE_PIN_PROOF_TTL_SECONDS = "900";
}

export function signedIngressRequest(
  clientAddress: string,
  peerAddress: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Request {
  const requestId = randomUUID();
  const timestamp = String(nowSeconds);
  const frame = `${requestId}.${timestamp}.${clientAddress}`;
  const signature = createHmac("sha256", SHARE_TEST_ATTESTATION_KEY)
    .update(frame, "utf8")
    .digest("base64url");
  return new Request("https://easyhealth.test/api/share/token", {
    headers: {
      "X-EH-Edge-Client-Address": clientAddress,
      "X-EH-Edge-Request-Id": requestId,
      "X-EH-Edge-Timestamp": timestamp,
      "X-EH-Edge-Signature": signature,
      "User-Agent": "Mozilla/5.0 fixture",
    },
  });
}

export function ingressRuntime(peerAddress: string) {
  return { getImmediatePeerAddress: () => peerAddress };
}
