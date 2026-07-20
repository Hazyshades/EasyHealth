import { loadE2EEnvironment } from "./support/env";
import { assertOrphanCleanupRequest, cleanupExpiredE2EOrphans } from "./support/orphan-cleanup";
import { redactSensitive } from "./support/redaction";

async function main(): Promise<void> {
  const env = loadE2EEnvironment();
  const before = assertOrphanCleanupRequest({
    allowed: process.env.E2E_ALLOW_ORPHAN_CLEANUP === "1",
    before: process.env.E2E_ORPHAN_BEFORE,
  });
  const count = await cleanupExpiredE2EOrphans(env, before);
  console.log(`Removed ${count} expired, E2E-prefixed synthetic profile(s) and only their scoped Storage paths.`);
}

void main().catch((error) => {
  console.error(redactSensitive(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
