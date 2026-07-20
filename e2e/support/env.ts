import { loadEnvConfig } from "@next/env";
import { randomUUID } from "node:crypto";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type E2EEnvironment = {
  baseURL: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  requestedRunId?: string;
};

export function loadE2EEnvironment(): E2EEnvironment {
  loadEnvConfig(process.cwd());

  const baseURL = required("E2E_BASE_URL");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");

  if (process.env.E2E_REMOTE_SUPABASE !== "1") {
    throw new Error("Remote E2E writes are disabled. Set E2E_REMOTE_SUPABASE=1 for the shared non-production Supabase project.");
  }

  assertLocalOrigin(baseURL);
  assertRemoteSupabaseUrl(supabaseUrl);

  const requestedRunId = process.env.E2E_RUN_ID?.trim();
  if (requestedRunId) assertRunId(requestedRunId);

  return { baseURL: normalizeOrigin(baseURL), supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey, requestedRunId };
}

export function createRunId(requestedRunId?: string): string {
  if (requestedRunId) {
    assertRunId(requestedRunId);
    return requestedRunId;
  }
  return `pw-${new Date().toISOString().replace(/[-:.TZ]/g, "").toLowerCase()}-${randomUUID().slice(0, 8)}`;
}

export function assertRunId(runId: string): void {
  if (!/^[a-z0-9][a-z0-9-]{5,63}$/.test(runId)) {
    throw new Error("E2E_RUN_ID must use lowercase letters, digits, and hyphens (6-64 characters).");
  }
}

export function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

export function assertLocalOrigin(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("E2E_BASE_URL must be an absolute local http(s) URL.");
  }
  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("E2E_BASE_URL must target the locally running EasyHealth server (localhost, 127.0.0.1, or ::1).");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("E2E_BASE_URL must use http or https.");
  }
}

export function assertRemoteSupabaseUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an absolute URL.");
  }
  if (LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error("E2E requires the shared remote Supabase project, not a local Supabase URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("The remote Supabase URL must use https.");
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required E2E environment variable: ${name}.`);
  return value;
}
