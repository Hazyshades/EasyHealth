import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { E2EEnvironment } from "./env";
import { safeE2EError } from "./redaction";

export const E2E_STORAGE_BUCKET = "lab-documents";

export function createE2EAdminClient(env: E2EEnvironment): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function assertSupabaseOk(result: { error: { message: string } | null }, operation: string): void {
  if (result.error) throw safeE2EError(`Remote E2E mutation failed during ${operation}`, result.error);
}

export function assertData<T>(result: { data: T | null; error: { message: string } | null }, operation: string): T {
  assertSupabaseOk(result, operation);
  if (result.data == null) throw new Error(`Remote E2E mutation returned no data during ${operation}.`);
  return result.data;
}
