import { chromium } from "@playwright/test";
import { existsSync } from "node:fs";
import { cleanupOwnedRun } from "./support/cleanup";
import { createRunId, loadE2EEnvironment } from "./support/env";
import {
  PRIMARY_STORAGE_STATE,
  RUN_CONTEXT_PATH,
  SAFETY_STORAGE_STATE,
  createRunContext,
  registerPrincipal,
  removeRunArtifacts,
  writeRunContext,
  type E2EPrincipal,
  type E2ERunContext,
} from "./support/ownership";
import { seedDeterministicFixtures } from "./support/fixtures";
import { refreshCachedSyntheses } from "./support/synthesis-cache";
import { redactSensitive } from "./support/redaction";
import { createE2EAdminClient, assertData, assertSupabaseOk } from "./support/supabase";
import { verifyE2EPreflight } from "./preflight";

export default async function globalSetup(): Promise<void> {
  const env = loadE2EEnvironment();
  await verifyE2EPreflight(env);

  if (existsSync(RUN_CONTEXT_PATH)) {
    throw new Error("An E2E ownership ledger already exists. Run `pnpm e2e:cleanup` before starting another remote E2E run.");
  }

  const context = createRunContext(createRunId(env.requestedRunId), env.baseURL);
  writeRunContext(context);
  const client = createE2EAdminClient(env);

  try {
    const primary = await createSyntheticPrincipal(client, context, "primary", PRIMARY_STORAGE_STATE);
    const safety = await createSyntheticPrincipal(client, context, "safety", SAFETY_STORAGE_STATE);
    await seedDeterministicFixtures(client, context);
    await refreshCachedSyntheses(client, context);
    await saveAuthenticatedStorageState(client, env.baseURL, primary);
    await saveAuthenticatedStorageState(client, env.baseURL, safety);
  } catch (error) {
    try {
      await cleanupOwnedRun(env, context);
      removeRunArtifacts();
    } catch (cleanupError) {
      console.error(redactSensitive(`E2E setup cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`));
    }
    throw new Error(redactSensitive(`E2E global setup failed: ${error instanceof Error ? error.message : String(error)}`));
  }
}

async function createSyntheticPrincipal(
  client: ReturnType<typeof createE2EAdminClient>,
  context: E2ERunContext,
  key: "primary" | "safety",
  storageStatePath: string,
): Promise<E2EPrincipal> {
  const email = `e2e+${context.runId}.${key}@easyhealth.test`;
  const created = await client.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: `E2E Synthetic ${key}` },
  });
  assertSupabaseOk(created, `create synthetic ${key} Auth user`);
  const authUser = created.data.user;
  if (!authUser) throw new Error(`Synthetic ${key} Auth user was not returned.`);

  // The Auth id is also the profile id. Register it before the profile upsert
  // so a later failure is still recoverable by the exact ownership ledger.
  const principal: E2EPrincipal = { authUserId: authUser.id, profileId: authUser.id, email, storageStatePath };
  registerPrincipal(context, key, principal);

  assertData(
    await client
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          email,
          display_name: `E2E Synthetic ${key}`,
          first_name: "E2E",
          last_name: "Synthetic",
          terms_accepted_at: new Date().toISOString(),
          terms_version: "e2e-v1",
          health_data_consent_at: new Date().toISOString(),
          ai_consent_at: new Date().toISOString(),
          consent_preferences: { e2e_synthetic_only: true },
          onboarding_completed_at: new Date().toISOString(),
          dashboard_preferences: {},
          lab_unit_system: "si",
        },
        { onConflict: "id" },
      )
      .select("id")
      .single(),
    `upsert synthetic ${key} profile`,
  );

  return principal;
}

async function saveAuthenticatedStorageState(
  client: ReturnType<typeof createE2EAdminClient>,
  baseURL: string,
  principal: E2EPrincipal,
): Promise<void> {
  const redirectTo = `${baseURL}/auth/callback`;
  const generated = await client.auth.admin.generateLink({
    type: "magiclink",
    email: principal.email,
    options: { redirectTo },
  });
  assertSupabaseOk(generated, `generate ${principal.email} magic link`);
  const tokenHash = generated.data?.properties?.hashed_token;
  const verificationType = generated.data?.properties?.verification_type;
  if (!tokenHash || verificationType !== "magiclink") {
    throw new Error("The E2E magic-link response did not include a verifiable magic-link token.");
  }

  // A browser receives implicit-flow tokens in a URL fragment, which never
  // reaches a Next.js route handler. Use the generated one-time token hash to
  // exercise the application's real server-side callback instead.
  const callbackURL = new URL(redirectTo);
  callbackURL.searchParams.set("token_hash", tokenHash);
  callbackURL.searchParams.set("type", verificationType);

  const browser = await chromium.launch();
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  try {
    await page.goto(callbackURL.toString(), { waitUntil: "commit", timeout: 20_000 });
    await page.waitForURL(
      (url) => url.origin === baseURL && url.pathname.startsWith("/app"),
      { timeout: 20_000 },
    );
    await browserContext.storageState({ path: principal.storageStatePath });
  } catch (error) {
    throw new Error(
      `The E2E auth callback did not establish a session. ${describeAuthNavigation(page.url(), baseURL)} Add ${redirectTo} to the remote Supabase Auth redirect allow list and confirm the local server origin matches E2E_BASE_URL. ${redactSensitive(error instanceof Error ? error.message : String(error))}`,
    );
  } finally {
    await browserContext.close();
    await browser.close();
  }
}

function describeAuthNavigation(currentURL: string, baseURL: string): string {
  try {
    const current = new URL(currentURL);
    const callback = new URL(`${baseURL}/auth/callback`);
    const destination = current.origin === callback.origin
      ? current.pathname === callback.pathname
        ? "The browser reached the configured callback path."
        : "The browser reached the configured local origin, but not the callback path."
      : "The browser did not reach the configured local origin.";
    const payload = current.searchParams.has("code")
      ? "Auth response has an authorization code."
      : current.hash.includes("access_token")
        ? "Auth response has a token fragment."
        : "Auth response has no recognized session payload.";
    return `${destination} ${payload}`;
  } catch {
    return "The final browser destination could not be classified.";
  }
}
