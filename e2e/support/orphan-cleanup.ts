import type { SupabaseClient } from "@supabase/supabase-js";
import type { E2EEnvironment } from "./env";
import type { E2EPrincipal } from "./ownership";
import { assertOwnedStoragePath } from "./ownership";
import { cleanupOwnedPrincipal } from "./cleanup";
import { E2E_STORAGE_BUCKET, assertSupabaseOk, createE2EAdminClient } from "./supabase";

const MINIMUM_ORPHAN_AGE_MS = 60 * 60 * 1_000;
const E2E_EMAIL_PATTERN = /^e2e\+([a-z0-9][a-z0-9-]{5,63})\.(primary|safety)@easyhealth\.test$/;

export type OrphanCleanupRequest = {
  allowed: boolean;
  before: string | undefined;
  now?: Date;
};

export function assertOrphanCleanupRequest(request: OrphanCleanupRequest): Date {
  if (!request.allowed) {
    throw new Error("Orphan cleanup is disabled. Set E2E_ALLOW_ORPHAN_CLEANUP=1 explicitly.");
  }
  if (!request.before) {
    throw new Error("Orphan cleanup requires E2E_ORPHAN_BEFORE as an ISO timestamp.");
  }
  const before = new Date(request.before);
  if (Number.isNaN(before.getTime())) {
    throw new Error("E2E_ORPHAN_BEFORE must be a valid ISO timestamp.");
  }
  const now = request.now ?? new Date();
  if (before.getTime() > now.getTime() - MINIMUM_ORPHAN_AGE_MS) {
    throw new Error("E2E_ORPHAN_BEFORE must be at least one hour in the past so an active E2E run cannot be selected.");
  }
  return before;
}

export async function cleanupExpiredE2EOrphans(env: E2EEnvironment, before: Date): Promise<number> {
  const client = createE2EAdminClient(env);
  const { data, error } = await client
    .from("profiles")
    .select("id, email, created_at")
    .like("email", "e2e+%@easyhealth.test")
    .lt("created_at", before.toISOString());
  assertSupabaseOk({ error }, "query expired synthetic E2E profiles");

  let cleaned = 0;
  for (const row of data ?? []) {
    if (!row.email || !row.id) continue;
    const parsed = E2E_EMAIL_PATTERN.exec(row.email);
    if (!parsed) continue;
    const runId = parsed[1];
    const storagePrefix = `e2e/${runId}/`;
    const storagePaths = await listStoragePaths(client, storagePrefix);
    for (const storagePath of storagePaths) {
      assertOwnedStoragePath({ runId, storagePrefix } as Parameters<typeof assertOwnedStoragePath>[0], storagePath);
    }
    if (storagePaths.length > 0) {
      assertSupabaseOk(
        await client.storage.from(E2E_STORAGE_BUCKET).remove(storagePaths),
        `remove expired E2E Storage namespace ${runId}`,
      );
    }

    const principal: E2EPrincipal = {
      authUserId: row.id,
      profileId: row.id,
      email: row.email,
      storageStatePath: "",
    };
    await cleanupOwnedPrincipal(client, { documents: {} }, principal);
    cleaned += 1;
  }
  return cleaned;
}

async function listStoragePaths(client: SupabaseClient, prefix: string): Promise<string[]> {
  const { data, error } = await client.storage.from(E2E_STORAGE_BUCKET).list(prefix, { limit: 1_000 });
  assertSupabaseOk({ error }, `list scoped E2E Storage namespace ${prefix}`);
  const files: string[] = [];
  for (const entry of data ?? []) {
    const item = entry as { name: string; id?: string | null };
    const childPath = `${prefix}${item.name}`;
    if (item.id) {
      files.push(childPath);
    } else {
      files.push(...await listStoragePaths(client, `${childPath}/`));
    }
  }
  return files;
}
