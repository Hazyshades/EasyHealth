/**
 * Contracts for authenticated /app/* navigation: read-only layout, fail-closed
 * callback, expiry-gated cookie refresh, and Documents first paint without a
 * serial /api/profile fetch.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { resolveAppShellRedirect } from "../src/lib/auth/app-shell-gate";
import { resolveAuthCallbackPath } from "../src/lib/auth/callback-redirect";
import { shouldRefreshAuthCookies } from "../src/lib/auth/session-cookie";
import {
  shouldPreserveInitialLoadFailure,
  shouldReuseServerDocuments,
} from "../src/lib/documents/hub-initial-load";

function readRepo(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

function walkFiles(root: string, acc: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walkFiles(full, acc);
      continue;
    }
    if (/\.(?:ts|tsx)$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

function testCallbackEnsureFailureDoesNotEnterApp(): void {
  const pathName = resolveAuthCallbackPath({
    hasCode: true,
    exchangeError: null,
    userId: "user-1",
    ensureFailed: true,
    next: "/app/documents",
    needsProfileGate: false,
    needsConsentGate: false,
  });
  assert.equal(pathName, "/?signin=error");
  assert.equal(
    resolveAuthCallbackPath({
      hasCode: true,
      exchangeError: null,
      userId: "user-1",
      ensureFailed: false,
      next: null,
      needsProfileGate: false,
      needsConsentGate: false,
    }),
    "/app",
  );
}

function testMissingProfileRedirectsToOnboarding(): void {
  assert.equal(
    resolveAppShellRedirect({ profileId: null, onboarding: null }),
    "/?signin=required",
  );
  assert.equal(
    resolveAppShellRedirect({ profileId: "profile-1", onboarding: null }),
    "/onboarding/profile",
  );
  assert.equal(
    resolveAppShellRedirect({
      profileId: "profile-1",
      onboarding: {
        profileId: "profile-1",
        firstName: "Perf",
        lastName: "User",
        hasAcceptedTerms: true,
        onboardingDismissedAt: "2026-01-01T00:00:00.000Z",
        onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
        bannerDismissedAt: null,
        needsProfileGate: false,
        needsConsentGate: false,
        showWizard: false,
        showSuccessBanner: true,
      },
    }),
    null,
  );
}

function testDocumentsFirstPaintReusesServerList(): void {
  assert.equal(
    shouldReuseServerDocuments({
      skipInitialFetch: true,
      activeTab: "lab_result",
      initialTab: "lab_result",
      alreadyConsumedInitial: false,
    }),
    true,
  );
  assert.equal(
    shouldReuseServerDocuments({
      skipInitialFetch: true,
      activeTab: "prescription",
      initialTab: "lab_result",
      alreadyConsumedInitial: false,
    }),
    false,
  );
  assert.equal(
    shouldReuseServerDocuments({
      skipInitialFetch: false,
      activeTab: "lab_result",
      initialTab: "lab_result",
      alreadyConsumedInitial: false,
    }),
    false,
  );
}

function testDocumentsFailureState(): void {
  assert.equal(
    shouldPreserveInitialLoadFailure({
      initialLoadFailed: true,
      activeTab: "lab_result",
      initialTab: "lab_result",
      alreadyConsumedInitial: false,
    }),
    true,
  );
  assert.equal(
    shouldPreserveInitialLoadFailure({
      initialLoadFailed: true,
      activeTab: "prescription",
      initialTab: "lab_result",
      alreadyConsumedInitial: false,
    }),
    false,
  );
  assert.equal(
    shouldPreserveInitialLoadFailure({
      initialLoadFailed: true,
      activeTab: "lab_result",
      initialTab: "lab_result",
      alreadyConsumedInitial: true,
    }),
    false,
  );
}

function jwtWithExp(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  return `${header}.${payload}.sig`;
}

function sessionCookie(session: Record<string, unknown>): string {
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

function testWarmValidTokenSkipsRefresh(): void {
  const nowMs = 1_700_000_000_000;
  const exp = Math.floor(nowMs / 1000) + 3600;
  const value = sessionCookie({
    access_token: jwtWithExp(exp),
    refresh_token: "refresh-token",
    expires_at: exp,
  });
  assert.deepEqual(
    shouldRefreshAuthCookies([{ name: "sb-127-auth-token", value }], nowMs),
    { refresh: false, reason: "valid" },
  );
}

function testNearExpiryAndExpiredRefresh(): void {
  const nowMs = 1_700_000_000_000;
  const nearExp = Math.floor(nowMs / 1000) + 30;
  const expired = Math.floor(nowMs / 1000) - 5;
  assert.deepEqual(
    shouldRefreshAuthCookies(
      [
        {
          name: "sb-127-auth-token",
          value: sessionCookie({
            access_token: jwtWithExp(nearExp),
            refresh_token: "refresh-token",
            expires_at: nearExp,
          }),
        },
      ],
      nowMs,
    ),
    { refresh: true, reason: "near-expiry" },
  );
  assert.deepEqual(
    shouldRefreshAuthCookies(
      [
        {
          name: "sb-127-auth-token",
          value: sessionCookie({
            access_token: jwtWithExp(expired),
            refresh_token: "refresh-token",
            expires_at: expired,
          }),
        },
      ],
      nowMs,
    ),
    { refresh: true, reason: "expired" },
  );
}

function testNoCookieAndMissingRefreshSkipTax(): void {
  assert.deepEqual(shouldRefreshAuthCookies([]), { refresh: false, reason: "no-cookie" });
  const nowMs = 1_700_000_000_000;
  assert.deepEqual(
    shouldRefreshAuthCookies(
      [
        {
          name: "sb-127-auth-token",
          value: sessionCookie({
            access_token: jwtWithExp(Math.floor(nowMs / 1000) - 10),
          }),
        },
      ],
      nowMs,
    ),
    { refresh: false, reason: "missing-refresh-token" },
  );
}

function testChunkedCookieIsReassembled(): void {
  const nowMs = 1_700_000_000_000;
  const exp = Math.floor(nowMs / 1000) + 3600;
  const value = sessionCookie({
    access_token: jwtWithExp(exp),
    refresh_token: "refresh-token",
    expires_at: exp,
  });
  const mid = Math.ceil(value.length / 2);
  assert.deepEqual(
    shouldRefreshAuthCookies(
      [
        { name: "sb-127-auth-token.0", value: value.slice(0, mid) },
        { name: "sb-127-auth-token.1", value: value.slice(mid) },
      ],
      nowMs,
    ),
    { refresh: false, reason: "valid" },
  );
}

function testSourceGuards(): void {
  const appLayout = readRepo("src/app/app/layout.tsx");
  assert.match(appLayout, /getSessionProfileId/);
  assert.doesNotMatch(appLayout, /getSessionProfileIdEnsured/);
  assert.doesNotMatch(appLayout, /ensureProfile/);

  const onboardingLayout = readRepo("src/app/onboarding/layout.tsx");
  assert.match(onboardingLayout, /getSessionProfileIdEnsured/);

  const callback = readRepo("src/app/auth/callback/route.ts");
  assert.match(callback, /ensureFailed:\s*true/);
  assert.match(callback, /resolveAuthCallbackPath/);

  const session = readRepo("src/lib/auth/session.ts");
  assert.match(session, /from "react"/);
  assert.match(session, /cache\(/);

  const middleware = readRepo("src/middleware.ts");
  assert.match(middleware, /shouldRefreshAuthCookies/);
  assert.match(middleware, /matcher:\s*\["\/app"/);

  const documentsRoot = path.join(process.cwd(), "src", "app", "app", "documents");
  for (const file of walkFiles(documentsRoot)) {
    const rel = path.relative(process.cwd(), file).replaceAll("\\", "/");
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /\/api\/profile/,
      `${rel} must not fetch /api/profile on Documents first paint`,
    );
  }

  const page = readRepo("src/app/app/documents/page.tsx");
  assert.match(page, /listDocumentsForProfile/);
  assert.match(page, /initialDocuments/);
  assert.match(page, /skipInitialFetch/);
  assert.doesNotMatch(page, /["']use client["']/);

  const hub = readRepo("src/app/app/documents/documents-hub.tsx");
  assert.match(hub, /shouldReuseServerDocuments/);
  assert.match(hub, /\/api\/documents\?type=/);
  assert.match(hub, /shouldPreserveInitialLoadFailure/);
  assert.match(
    hub,
    /\.catch\(\(\) => \{\s+setLoadError\(true\);/,
    "soft and hard document list fetch failures must surface an error",
  );
  assert.match(
    hub,
    /if \(!soft\) setLoading\(false\);/,
    "soft document refreshes must not become hard loading states",
  );
  assert.doesNotMatch(hub, /if \(!soft\) setLoadError\(true\)/);
}

function main(): void {
  testCallbackEnsureFailureDoesNotEnterApp();
  testMissingProfileRedirectsToOnboarding();
  testDocumentsFirstPaintReusesServerList();
  testWarmValidTokenSkipsRefresh();
  testNearExpiryAndExpiredRefresh();
  testNoCookieAndMissingRefreshSkipTax();
  testChunkedCookieIsReassembled();
  testDocumentsFailureState();
  testSourceGuards();
  console.log("verify-app-navigation-hot-path: all checks passed");
}

main();
