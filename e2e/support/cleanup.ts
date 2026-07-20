import type { E2ERunContext, E2EPrincipal } from "./ownership";
import { assertOwnedStoragePath } from "./ownership";
import { E2E_STORAGE_BUCKET, assertSupabaseOk, createE2EAdminClient } from "./supabase";
import type { E2EEnvironment } from "./env";
import { safeE2EError } from "./redaction";

const STORAGE_DELETE_BATCH_SIZE = 100;

export async function cleanupOwnedRun(env: E2EEnvironment, context: E2ERunContext): Promise<void> {
  const client = createE2EAdminClient(env);
  const failures: Error[] = [];

  for (const path of context.storagePaths) assertOwnedStoragePath(context, path);
  for (const paths of chunk(context.storagePaths, STORAGE_DELETE_BATCH_SIZE)) {
    if (paths.length === 0) continue;
    try {
      assertSupabaseOk(await client.storage.from(E2E_STORAGE_BUCKET).remove(paths), "owned E2E Storage cleanup");
    } catch (error) {
      failures.push(safeE2EError("E2E Storage cleanup", error));
    }
  }

  for (const principal of Object.values(context.principals)) {
    if (!principal) continue;
    try {
      await cleanupOwnedPrincipal(client, context, principal);
    } catch (error) {
      failures.push(safeE2EError(`E2E cleanup for ${principal.email}`, error));
    }
  }

  if (failures.length) {
    throw new Error(`E2E teardown retained its ownership ledger after ${failures.length} scoped cleanup failure(s): ${failures.map((failure) => failure.message).join(" | ")}`);
  }
}

export async function cleanupOwnedPrincipal(
  client: ReturnType<typeof createE2EAdminClient>,
  context: Pick<E2ERunContext, "documents">,
  principal: E2EPrincipal,
): Promise<void> {
  const documentIds = Object.values(context.documents)
    .filter((document) => document.profileId === principal.profileId)
    .map((document) => document.id);

  // Every query remains scoped to the synthetic principal. No reset, truncate,
  // or unscoped Storage/database delete is available in this harness.
  assertSupabaseOk(
    await client.from("observations").delete().eq("profile_id", principal.profileId),
    "owned E2E observations cleanup",
  );

  if (documentIds.length > 0) {
    assertSupabaseOk(
      await client.from("documents").delete().eq("profile_id", principal.profileId).in("id", documentIds),
      "owned E2E documents cleanup",
    );
  }

  assertSupabaseOk(
    await client.from("profiles").delete().eq("id", principal.profileId).eq("email", principal.email),
    "owned E2E profile cleanup",
  );
  assertSupabaseOk(
    await client.auth.admin.deleteUser(principal.authUserId),
    "owned E2E Auth user cleanup",
  );
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) batches.push([...values.slice(index, index + size)]);
  return batches;
}
