import assert from "node:assert/strict";
import {
  hashSharePin,
  verifySharePin,
  generatePinProof,
  proofDigest,
} from "../src/lib/share-links/pin";
import { applyPublicShareResponsePolicy } from "../src/lib/share-links/public-response-policy";
import { getPublicShareExportActions } from "../src/lib/share-links/public-export-actions";
import { requireTrustedIngress } from "../src/lib/share-links/trusted-ingress";
import {
  getTrustedIngressContext,
  parseCanonicalAddress,
} from "../src/lib/share-links/trusted-ingress-transport";
import {
  InvalidShareTokenError,
  ShareTokenConfigurationError,
  digestShareToken,
  generateShareToken,
  parseShareToken,
} from "../src/lib/share-links/tokens";
import { consumeShareFailureRateLimits } from "../src/lib/share-links/rate-limit";
import {
  configureShareTestEnvironment,
  ingressRuntime,
  SHARE_TEST_TOKEN_KEYS,
  signedIngressRequest,
} from "./fixtures/eh151-scoped-share-links";

function replaceHeader(request: Request, name: string, value: string): Request {
  const headers = new Headers(request.headers);
  headers.set(name, value);
  return new Request(request.url, { headers });
}

async function main(): Promise<void> {
  configureShareTestEnvironment();
  const rateLimitCalls: Record<string, unknown>[] = [];
  const rateLimitStore = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      rateLimitCalls.push(args);
      return {
        data: { allowed: true, retry_after_seconds: 0, store_available: true },
        error: null,
      };
    },
  } as unknown as Parameters<typeof consumeShareFailureRateLimits>[0];
  await consumeShareFailureRateLimits(rateLimitStore, {
    tokenKey: null,
    requesterAddress: "198.51.100.9",
    userAgent: null,
    now: new Date("2026-09-28T00:00:00.000Z"),
  });
  assert.equal(rateLimitCalls.length, 1);
  assert.equal(rateLimitCalls[0].p_limit, 30);
  assert.match(String(rateLimitCalls[0].p_key_digest), /^[0-9a-f]{64}$/);
  rateLimitCalls.length = 0;
  await consumeShareFailureRateLimits(rateLimitStore, {
    tokenKey: "a".repeat(64),
    requesterAddress: "198.51.100.9",
    userAgent: null,
    now: new Date("2026-09-28T00:00:00.000Z"),
  });
  assert.deepEqual(
    rateLimitCalls.map((call) => call.p_limit),
    [30, 10],
  );

  const generated = generateShareToken();
  const parsed = parseShareToken(generated.token);
  assert.ok(parsed);
  assert.equal(parsed.tokenKeyVersion, "2026-1");
  assert.ok(Buffer.from(parsed.random, "base64url").length >= 32);
  assert.equal(
    digestShareToken(generated.token).tokenDigest,
    generated.tokenDigest,
  );
  assert.notEqual(generated.tokenDigest, generated.token);

  const oldToken = `v2025-1.${parsed.random}`;
  assert.equal(digestShareToken(oldToken).tokenKeyVersion, "2025-1");

  process.env.SHARE_TOKEN_KEY_RING = JSON.stringify({
    "2026-1": "test-share-token-key-2026-1-strong",
    "2025-1": "test-share-token-key-2025-1-strong",
    "2024-1": "stale-share-token-key-2024-1-strong",
  });
  assert.throws(
    () => digestShareToken(generated.token),
    ShareTokenConfigurationError,
  );
  process.env.SHARE_TOKEN_KEY_RING = SHARE_TEST_TOKEN_KEYS;
  assert.equal(parseShareToken("v2026-1.short"), null);
  assert.throws(
    () => digestShareToken("unkeyed-token"),
    InvalidShareTokenError,
  );
  assert.throws(
    () => digestShareToken(`vunknown.${parsed.random}`),
    InvalidShareTokenError,
  );

  const pin = await hashSharePin("2468");
  assert.equal(await verifySharePin("2468", pin.hash, pin.salt), true);
  assert.equal(await verifySharePin("1357", pin.hash, pin.salt), false);
  const proof = generatePinProof();
  assert.notEqual(proof.proof, proof.proofDigest);
  assert.equal(proof.proofDigest, proofDigest(proof.proof));

  const validIngressRequest = signedIngressRequest("198.51.100.9", "10.2.3.4");
  const trusted = getTrustedIngressContext(
    validIngressRequest,
    ingressRuntime("10.2.3.4"),
  );
  assert.equal("edgeVerifiedClientAddress" in trusted, true);
  if ("edgeVerifiedClientAddress" in trusted) {
    assert.equal(trusted.edgeVerifiedClientAddress, "198.51.100.9");
  }
  const untrusted = getTrustedIngressContext(
    validIngressRequest,
    ingressRuntime("192.0.2.9"),
  );
  assert.equal("ok" in untrusted, true);
  if ("ok" in untrusted) assert.equal(untrusted.ok, false);
  const spoofed = getTrustedIngressContext(
    replaceHeader(validIngressRequest, "X-Forwarded-For", "198.51.100.9"),
    ingressRuntime("10.2.3.4"),
  );
  assert.equal("edgeVerifiedClientAddress" in spoofed, true);
  const badSignature = getTrustedIngressContext(
    replaceHeader(validIngressRequest, "X-EH-Edge-Signature", "spoofed"),
    ingressRuntime("10.2.3.4"),
  );
  assert.equal("ok" in badSignature, true);
  if ("ok" in badSignature) assert.equal(badSignature.ok, false);
  const directOrigin = requireTrustedIngress(validIngressRequest);
  assert.equal(directOrigin.ok, false);
  assert.equal(directOrigin.status, 503);
  assert.equal(parseCanonicalAddress("198.51.100.9")?.family, 4);

  const response = applyPublicShareResponsePolicy(new Response("fixture"));
  assert.equal(response.headers.get("Cache-Control"), "no-store, private");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow");
  assert.equal(response.headers.get("Referrer-Policy"), "no-referrer");
  assert.deepEqual(getPublicShareExportActions(["pdf", "json"]), [
    { format: "pdf", label: "PDF" },
    { format: "json", label: "JSON" },
  ]);

  console.log("EH-151 scoped share route fixtures passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
