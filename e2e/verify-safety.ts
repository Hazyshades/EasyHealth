import assert from "node:assert/strict";
import { assertOrphanCleanupRequest } from "./support/orphan-cleanup";
import { assertOwnedStoragePath, createRunContext, registerStoragePath } from "./support/ownership";
import { redactSensitive } from "./support/redaction";

const now = new Date("2026-07-20T12:00:00.000Z");

assert.throws(
  () => assertOrphanCleanupRequest({ allowed: false, before: "2026-07-19T10:00:00.000Z", now }),
  /disabled/,
);
assert.throws(
  () => assertOrphanCleanupRequest({ allowed: true, before: undefined, now }),
  /requires E2E_ORPHAN_BEFORE/,
);
assert.throws(
  () => assertOrphanCleanupRequest({ allowed: true, before: "2026-07-20T11:30:00.000Z", now }),
  /at least one hour/,
);
assert.equal(
  assertOrphanCleanupRequest({ allowed: true, before: "2026-07-20T10:00:00.000Z", now }).toISOString(),
  "2026-07-20T10:00:00.000Z",
);

const context = createRunContext("pw-safety-123456", "http://localhost:3000");
assert.throws(() => assertOwnedStoragePath(context, "anything-not-owned"), /unowned/);
assert.throws(() => registerStoragePath(context, "e2e/other-run/object.svg"), /unowned/);

const redacted = redactSensitive(
  "Authorization: Bearer synthetic-secret https://example.test/auth?token=synthetic-token&code=synthetic-code#access_token=synthetic-access-token&refresh_token=synthetic-refresh-token",
);
assert.equal(redacted.includes("synthetic-secret"), false);
assert.equal(redacted.includes("synthetic-token"), false);
assert.equal(redacted.includes("synthetic-code"), false);
assert.equal(redacted.includes("synthetic-access-token"), false);
assert.equal(redacted.includes("synthetic-refresh-token"), false);
console.log("E2E cleanup safety guards passed.");
