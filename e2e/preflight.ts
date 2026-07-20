import { loadE2EEnvironment, type E2EEnvironment } from "./support/env";
import { redactSensitive, safeE2EError } from "./support/redaction";
import { createE2EAdminClient } from "./support/supabase";

export async function verifyEasyHealthOrigin(baseURL: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(baseURL, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw safeE2EError(`Cannot reach E2E_BASE_URL ${baseURL}`, error);
  }

  if (!response.ok) {
    throw new Error(`E2E_BASE_URL ${baseURL} returned HTTP ${response.status}; start the local EasyHealth server first.`);
  }

  const documentText = await response.text();
  if (!/easyhealth/i.test(documentText)) {
    throw new Error(`E2E_BASE_URL ${baseURL} did not identify itself as EasyHealth. Refusing remote E2E setup.`);
  }
}

export async function verifyE2EPreflight(env: E2EEnvironment): Promise<void> {
  await verifyEasyHealthOrigin(env.baseURL);

  // This is a read-only schema check. It catches a shared-database migration
  // gap before global setup creates an Auth user, profile, document, or object.
  const { error } = await createE2EAdminClient(env)
    .from("document_extracted_instrumental_measures")
    .select("id")
    .limit(1);
  if (error) {
    if (error.code === "PGRST205") {
      throw new Error(
        "The shared remote Supabase schema is missing document_extracted_instrumental_measures. Apply supabase/migrations/032_eh105_instrumental_observation_lineage.sql before running E2E.",
      );
    }
    throw safeE2EError("Cannot verify the remote E2E schema", error);
  }
}

async function main(): Promise<void> {
  const env = loadE2EEnvironment();
  await verifyE2EPreflight(env);
  console.log(`E2E preflight passed for ${env.baseURL}.`);
  console.log("Remote Supabase credentials, schema, and remote E2E opt-in are ready.");
}

void main().catch((error) => {
  console.error(redactSensitive(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
