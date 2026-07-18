import { readEh104ResolutionVerificationPreflight } from "../src/lib/documents/eh104-preflight";

async function main() {
  const findings = await readEh104ResolutionVerificationPreflight();
  console.log(JSON.stringify({ findingCount: findings.length, findings }, null, 2));
  if (findings.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
