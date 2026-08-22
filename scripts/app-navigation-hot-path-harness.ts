/**
 * Live `next start` harness for authenticated /app/documents RSC.
 * Asserts warm p50/p95 budgets, zero profiles upserts, and stale-token Set-Cookie.
 */
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { connect as netConnect } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { createServerClient } from "@supabase/ssr";
import {
  collectSupabaseAuthCookieValue,
  parseSupabaseAuthSession,
} from "../src/lib/auth/session-cookie";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env");
const OUT_DIR = path.join(ROOT, ".tmp");
const OUT_FILE = path.join(OUT_DIR, "app-navigation-hot-path-harness.json");
const EMAIL = "rsc-perf@example.com";
const PASSWORD = "rsc-perf-password-123";
const SENTINEL_DISPLAY_NAME = "HotPath Sentinel";
const WARM_SAMPLES = 10;
const P50_BUDGET_MS = 80;
const P95_BUDGET_MS = 150;

type EnvMap = Record<string, string>;

function loadEnvFile(): EnvMap {
  const env: EnvMap = {};
  if (!existsSync(ENV_PATH)) return env;
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function requiredEnv(env: EnvMap, key: string): string {
  const value = env[key] || process.env[key];
  if (!value) throw new Error(`Missing ${key}`);
  return value.replace(/\/$/, "");
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

async function http(
  method: string,
  url: string,
  init: { headers?: Record<string, string>; body?: unknown; timeoutMs?: number } = {},
): Promise<{ ms: number; status: number; body: string; setCookie: string[]; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 60_000);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(init.body != null ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
      body: init.body == null ? undefined : JSON.stringify(init.body),
      redirect: "manual",
      signal: controller.signal,
    });
    const body = await response.text();
    return {
      ms: performance.now() - started,
      status: response.status,
      body,
      setCookie: response.headers.getSetCookie?.() ?? [],
      headers: response.headers,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function portFree(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const socket = netConnect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(false);
    });
    socket.once("error", () => resolve(true));
  });
}

async function waitForUrl(url: string, timeoutMs = 120_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await http("GET", url, { timeoutMs: 3000 });
      if (result.status > 0) return;
    } catch {
      // keep waiting
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function ensureUser(env: EnvMap): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
  const url = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const anon = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");

  await http("POST", `${url}/auth/v1/admin/users`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
    body: { email: EMAIL, password: PASSWORD, email_confirm: true },
  });

  const token = await http("POST", `${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    body: { email: EMAIL, password: PASSWORD },
  });
  assert.equal(token.status, 200, `password login failed: ${token.body}`);
  const parsed = JSON.parse(token.body) as {
    access_token: string;
    refresh_token: string;
    user: { id: string };
  };

  const now = new Date().toISOString();
  const profile = await http("POST", `${url}/rest/v1/profiles?on_conflict=id`, {
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: {
      id: parsed.user.id,
      email: EMAIL,
      display_name: SENTINEL_DISPLAY_NAME,
      first_name: "Perf",
      last_name: "User",
      terms_accepted_at: now,
      terms_version: "2026-01-01",
      health_data_consent_at: now,
      ai_consent_at: now,
      onboarding_dismissed_at: now,
      onboarding_completed_at: now,
      consent_preferences: { analytics: false },
    },
  });
  assert.ok(profile.status < 300, `profile upsert failed: ${profile.status} ${profile.body}`);

  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    userId: parsed.user.id,
  };
}

async function snapshotProfile(env: EnvMap, userId: string): Promise<Record<string, unknown>> {
  const url = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const service = requiredEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const result = await http(
    "GET",
    `${url}/rest/v1/profiles?id=eq.${userId}&select=id,email,display_name,first_name,last_name,terms_accepted_at,onboarding_completed_at`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  assert.equal(result.status, 200, result.body);
  const rows = JSON.parse(result.body) as Record<string, unknown>[];
  assert.equal(rows.length, 1, "expected one profile row");
  return rows[0] ?? {};
}

async function ssrCookieHeader(env: EnvMap, accessToken: string, refreshToken: string): Promise<string> {
  const url = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_URL");
  const anon = requiredEnv(env, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return jar.map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        for (const cookie of cookies) {
          const index = jar.findIndex((item) => item.name === cookie.name);
          if (index >= 0) jar[index] = cookie;
          else jar.push(cookie);
        }
      },
    },
  });
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  assert.ok(jar.length > 0, "expected SSR auth cookies");
  return jar.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

function expireAccessTokenInCookieHeader(cookieHeader: string): string {
  const cookies = cookieHeader.split(/;\s*/).flatMap((part) => {
    const index = part.indexOf("=");
    if (index < 0) return [];
    return [{ name: part.slice(0, index), value: part.slice(index + 1) }];
  });
  const raw = collectSupabaseAuthCookieValue(cookies);
  if (!raw) throw new Error("no auth cookie to expire");
  const decoded = parseSupabaseAuthSession(raw);
  if (!decoded?.access_token || !decoded.refresh_token) {
    throw new Error("auth cookie missing tokens");
  }
  const expired = Math.floor(Date.now() / 1000) - 120;
  const [header, payload] = decoded.access_token.split(".");
  if (!header || !payload) throw new Error("access token is not a JWT");
  const claims = JSON.parse(
    Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
  ) as Record<string, unknown>;
  claims.exp = expired;
  const nextPayload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const nextSession = {
    ...decoded,
    access_token: `${header}.${nextPayload}.expired`,
    expires_at: expired,
  };
  const baseName = cookies.find((cookie) => /^sb-.+-auth-token/.test(cookie.name))?.name.replace(/\.\d+$/, "");
  if (!baseName) throw new Error("could not derive auth cookie name");
  const encoded = `base64-${Buffer.from(JSON.stringify(nextSession)).toString("base64url")}`;
  const others = cookies.filter((cookie) => !/^sb-.+-auth-token(?:\.\d+)?$/.test(cookie.name));
  return [...others.map((cookie) => `${cookie.name}=${cookie.value}`), `${baseName}=${encoded}`].join("; ");
}

async function rscDocuments(baseUrl: string, cookie: string, stamp: string) {
  return await http("GET", `${baseUrl}/app/documents?_rsc=${encodeURIComponent(stamp)}`, {
    headers: {
      Cookie: cookie,
      RSC: "1",
      Accept: "text/x-component",
      "Next-Url": "/app/documents",
      "Cache-Control": "no-store",
    },
  });
}

function looksLikeSignIn(body: string): boolean {
  return body.includes("signin=required") || body.includes("Sign in");
}

async function spawnNextStart(port: number, env: EnvMap): Promise<ChildProcess> {
  const nextEnv: NodeJS.ProcessEnv = { ...process.env, ...env, PORT: String(port) };
  return spawn("npx", ["next", "start", "-p", String(port)], {
    cwd: ROOT,
    env: nextEnv,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

async function ensureServer(env: EnvMap): Promise<{ baseUrl: string; child: ChildProcess | null }> {
  const provided = process.env.APP_BASE_URL;
  if (provided) {
    await waitForUrl(provided.replace(/\/$/, "") + "/");
    return { baseUrl: provided.replace(/\/$/, ""), child: null };
  }

  const port = Number(process.env.APP_PORT || 3010);
  if (!(await portFree(port))) {
    await waitForUrl(`http://127.0.0.1:${port}/`);
    return { baseUrl: `http://127.0.0.1:${port}`, child: null };
  }
  if (!existsSync(path.join(ROOT, ".next"))) {
    throw new Error("No .next build found. Run `pnpm build` or set APP_BASE_URL to a next start origin.");
  }
  const child = await spawnNextStart(port, env);
  await waitForUrl(`http://127.0.0.1:${port}/`);
  return { baseUrl: `http://127.0.0.1:${port}`, child };
}

async function main(): Promise<void> {
  const env = { ...loadEnvFile() };
  const auth = await ensureUser(env);
  const cookie = await ssrCookieHeader(env, auth.accessToken, auth.refreshToken);
  const before = await snapshotProfile(env, auth.userId);
  assert.equal(before.display_name, SENTINEL_DISPLAY_NAME);

  const { baseUrl, child } = await ensureServer(env);
  try {
    const warmup = await rscDocuments(baseUrl, cookie, "warmup");
    assert.ok(warmup.status < 400, `warmup RSC failed: ${warmup.status}`);
    assert.equal(looksLikeSignIn(warmup.body), false, "warmup RSC looked unauthenticated");

    const samples: number[] = [];
    for (let i = 0; i < WARM_SAMPLES; i += 1) {
      const sample = await rscDocuments(baseUrl, cookie, `warm${i}`);
      assert.ok(sample.status < 400, `warm RSC ${i} failed: ${sample.status}`);
      assert.equal(looksLikeSignIn(sample.body), false, `warm RSC ${i} looked unauthenticated`);
      samples.push(sample.ms);
    }

    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    const after = await snapshotProfile(env, auth.userId);
    assert.deepEqual(after, before, "profiles row changed during warm RSC; upsert is forbidden on the hot path");

    const staleCookie = expireAccessTokenInCookieHeader(cookie);
    const stale = await http("GET", `${baseUrl}/app/documents`, {
      headers: { Cookie: staleCookie, Accept: "text/html" },
    });
    const setCookie = stale.setCookie.filter((value) => /sb-.+-auth-token/.test(value));
    assert.ok(setCookie.length > 0, `stale-token response missing Set-Cookie; status=${stale.status}`);

    const refreshed = setCookie.map((value) => value.split(";")[0]).join("; ");
    const followUp = await rscDocuments(baseUrl, refreshed, "after-refresh");
    assert.ok(followUp.status < 400, `follow-up RSC failed: ${followUp.status}`);
    assert.equal(looksLikeSignIn(followUp.body), false, "follow-up RSC looked unauthenticated");

    const report = {
      baseUrl,
      p50,
      p95,
      samples,
      budgets: { p50: P50_BUDGET_MS, p95: P95_BUDGET_MS },
      profileUnchanged: true,
      staleTokenSetCookie: setCookie.length,
      followUpMs: followUp.ms,
    };
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT_FILE, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));

    const skipBudget = process.env.SKIP_RSC_BUDGET === "1";
    if (!skipBudget) {
      assert.ok(p50 <= P50_BUDGET_MS, `p50 ${p50.toFixed(1)}ms exceeds ${P50_BUDGET_MS}ms`);
      assert.ok(p95 <= P95_BUDGET_MS, `p95 ${p95.toFixed(1)}ms exceeds ${P95_BUDGET_MS}ms`);
    } else {
      console.warn("SKIP_RSC_BUDGET=1: recorded timings without asserting production budgets");
    }
    console.log("app-navigation-hot-path-harness: passed");
  } finally {
    if (child?.pid) {
      child.kill("SIGTERM");
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
