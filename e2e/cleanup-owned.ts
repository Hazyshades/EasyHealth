import { existsSync } from "node:fs";
import { cleanupOwnedRun } from "./support/cleanup";
import { loadE2EEnvironment } from "./support/env";
import { RUN_CONTEXT_PATH, readRunContext, removeRunArtifacts } from "./support/ownership";
import { redactSensitive } from "./support/redaction";

async function main(): Promise<void> {
  if (!existsSync(RUN_CONTEXT_PATH)) {
    console.log("No E2E ownership ledger is present; nothing to clean.");
    return;
  }
  const env = loadE2EEnvironment();
  const context = readRunContext();
  await cleanupOwnedRun(env, context);
  removeRunArtifacts();
  console.log(`Removed only resources owned by E2E run ${context.runId}.`);
}

void main().catch((error) => {
  console.error(redactSensitive(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
