/**
 * EH-104 Phase B populated-data preflight.
 *
 * Exit codes:
 *   0 — clean (zero findings); enforcement migration may proceed
 *   1 — findings present or tool error
 *
 * Persistent / retained environments MUST abort on findings (no mutation).
 * Disposable pre-production reset is a separate command:
 *   pnpm reset:eh104-phase-b
 * and requires EH104_PHASE_B_ALLOW_RESET=1 plus EH104_PHASE_B_DISPOSABLE=1.
 */
import { readEh104ResolutionVerificationPreflight } from "../src/lib/documents/eh104-preflight";

async function main() {
  const findings = await readEh104ResolutionVerificationPreflight();
  const summary = {
    findingCount: findings.length,
    status: findings.length === 0 ? "clean" : "blocked",
    policy: {
      persistent: "abort with diagnostics; do not mutate or apply Phase B enforcement",
      disposableReset:
        "only with EH104_PHASE_B_DISPOSABLE=1 and EH104_PHASE_B_ALLOW_RESET=1 via pnpm reset:eh104-phase-b; re-run preflight until clean",
    },
    findings,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (findings.length > 0) {
    console.error(
      `EH-104 preflight blocked: ${findings.length} finding(s). ` +
        "Persistent environments must abort. Disposable reset requires explicit allow flags."
    );
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
