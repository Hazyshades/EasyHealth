import { existsSync } from "node:fs";
import { cleanupOwnedRun } from "./support/cleanup";
import { loadE2EEnvironment } from "./support/env";
import { RUN_CONTEXT_PATH, readRunContext, removeRunArtifacts } from "./support/ownership";
import { redactSensitive } from "./support/redaction";

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(RUN_CONTEXT_PATH)) return;

  try {
    const env = loadE2EEnvironment();
    const context = readRunContext();
    await cleanupOwnedRun(env, context);
    removeRunArtifacts();
    console.log(`E2E teardown removed only owned resources for run ${context.runId}.`);
  } catch (error) {
    throw new Error(redactSensitive(`E2E teardown failed; the scoped ownership ledger was retained for recovery: ${error instanceof Error ? error.message : String(error)}`));
  }
}
