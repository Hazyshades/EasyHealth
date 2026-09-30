import { strict as assert } from "node:assert";
import {
  generateShareToken,
  digestShareToken,
} from "../src/lib/share-links/tokens";
import {
  projectOwnerShares,
  type ShareAccessEventSource,
  type ShareLinkSource,
} from "@/lib/share-management/projection";
import { isShareIdempotencyKey } from "@/lib/share-management/tokens";

const NOW = new Date("2026-09-27T12:00:00.000Z");
const OWNER_ID = "owner-a";
const OTHER_OWNER_ID = "owner-b";

const links: ShareLinkSource[] = [
  {
    id: "active-share",
    profile_id: OWNER_ID,
    report_id: "report-a",
    expires_at: "2026-10-01T12:00:00.000Z",
    revoked_at: null,
    download_policy: "report",
    allowed_export_formats: ["pdf", "json", "secret-format"],
    created_at: "2026-09-20T12:00:00.000Z",
    last_accessed_at: "2026-09-27T11:59:00.000Z",
    reports: { title: "Synthetic report A" },
  },
  {
    id: "expired-share",
    profile_id: OWNER_ID,
    report_id: "report-b",
    expires_at: "2026-09-26T12:00:00.000Z",
    revoked_at: null,
    download_policy: "none",
    allowed_export_formats: [],
    created_at: "2026-09-19T12:00:00.000Z",
    last_accessed_at: null,
    reports: { title: "Synthetic report B" },
  },
  {
    id: "revoked-share",
    profile_id: OWNER_ID,
    report_id: "report-c",
    expires_at: "2026-10-15T12:00:00.000Z",
    revoked_at: "2026-09-25T12:00:00.000Z",
    download_policy: "documents",
    allowed_export_formats: ["csv"],
    created_at: "2026-09-18T12:00:00.000Z",
    last_accessed_at: "2026-09-24T12:00:00.000Z",
    reports: { title: "Synthetic report C" },
  },
  {
    id: "other-profile-share",
    profile_id: OTHER_OWNER_ID,
    report_id: "report-other",
    expires_at: "2026-10-20T12:00:00.000Z",
    revoked_at: null,
    download_policy: "report",
    allowed_export_formats: ["json"],
    created_at: "2026-09-21T12:00:00.000Z",
    last_accessed_at: "2026-09-27T11:00:00.000Z",
    reports: { title: "Other profile report" },
  },
];

const events: ShareAccessEventSource[] = [
  {
    share_id: "active-share",
    occurred_at: "2026-09-27T11:58:00.000Z",
    result: "allowed",
    resource_kind: "report",
    client_class: "browser",
    retention_expires_at: "2026-10-27T11:58:00.000Z",
  },
  {
    share_id: "active-share",
    occurred_at: "2026-09-27T11:57:00.000Z",
    result: "denied",
    resource_kind: "report",
    client_class: "automation",
    retention_expires_at: "2026-10-27T11:57:00.000Z",
  },
  {
    share_id: "active-share",
    occurred_at: "2026-09-27T11:56:30.000Z",
    result: "pin_invalid",
    resource_kind: "pin",
    client_class: "browser",
    retention_expires_at: "2026-10-27T11:56:30.000Z",
  },
  {
    share_id: "active-share",
    occurred_at: "2026-09-27T11:59:00.000Z",
    result: "allowed",
    resource_kind: "export",
    client_class: "browser",
    retention_expires_at: "2026-10-27T11:59:00.000Z",
  },

  {
    share_id: "active-share",
    occurred_at: "2026-09-27T11:56:00.000Z",
    result: "rate_limited",
    resource_kind: "api",
    client_class: "other",
    retention_expires_at: "2026-09-26T11:56:00.000Z",
  },
  {
    share_id: "active-share",
    occurred_at: "2026-09-27T11:55:00.000Z",
    result: "unknown-secret-result",
    resource_kind: "report",
    client_class: "browser",
    retention_expires_at: "2026-10-27T11:55:00.000Z",
  },
  {
    share_id: "other-profile-share",
    occurred_at: "2026-09-27T11:54:00.000Z",
    result: "allowed",
    resource_kind: "report",
    client_class: "browser",
    retention_expires_at: "2026-10-27T11:54:00.000Z",
  },
];

const ownerShares = projectOwnerShares(OWNER_ID, links, events, NOW);
assert.deepEqual(
  ownerShares.map((share) => [share.id, share.status]),
  [
    ["active-share", "active"],
    ["expired-share", "expired"],
    ["revoked-share", "revoked"],
  ],
);
assert.equal(
  ownerShares.some((share) => share.id === "other-profile-share"),
  false,
);

const activeShare = ownerShares[0]!;
assert.equal(activeShare.outcomes.allowed, 2);
assert.equal(activeShare.outcomes.denied, 2);
assert.equal(activeShare.outcomes.rate_limited, 0);
assert.equal(activeShare.access_history.length, 4);
assert.equal(activeShare.last_accessed_at, "2026-09-27T11:59:00.000Z");
assert.deepEqual(activeShare.allowed_export_formats, ["pdf", "json"]);

const projectedJson = JSON.stringify(ownerShares);
for (const forbidden of [
  "token_digest",
  "pin_hash",
  "pin_salt",
  "storage_path",
  "raw_ip",
  "user_agent",
  "bearer-token",
]) {
  assert.equal(
    projectedJson.includes(forbidden),
    false,
    `projection leaked ${forbidden}`,
  );
}

process.env.SHARE_TOKEN_KEY_RING = JSON.stringify({
  "2026-01": "synthetic-share-token-key-strong",
});
process.env.SHARE_TOKEN_CURRENT_KEY_VERSION = "2026-01";
const token = generateShareToken();
const randomPart = token.token.slice(token.token.indexOf(".") + 1);
assert.equal(Buffer.from(randomPart, "base64url").byteLength, 32);
assert.equal(digestShareToken(token.token).tokenDigest, token.tokenDigest);
assert.match(token.token, /^v2026-01\.[A-Za-z0-9_-]+$/);

assert.equal(isShareIdempotencyKey("owner-share-key_01"), true);
assert.equal(isShareIdempotencyKey(""), false);
assert.equal(isShareIdempotencyKey("contains spaces"), false);
assert.equal(isShareIdempotencyKey("x".repeat(129)), false);

console.log("EH-152 share management fixtures passed");
