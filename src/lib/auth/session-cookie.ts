export const ACCESS_TOKEN_REFRESH_SKEW_MS = 60_000;

export type CookiePair = {
  name: string;
  value: string;
};

export type AuthCookieRefreshDecision = {
  refresh: boolean;
  reason:
    | "no-cookie"
    | "unreadable-session"
    | "missing-refresh-token"
    | "missing-access-token"
    | "invalid-access-token"
    | "expired"
    | "near-expiry"
    | "valid";
};

const AUTH_COOKIE_NAME = /^(sb-.+?-auth-token)(?:\.(\d+))?$/;

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return atob(padded);
}

function decodeJwtExp(accessToken: string): number | null {
  const parts = accessToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1] ?? "")) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function collectSupabaseAuthCookieValue(cookies: readonly CookiePair[]): string | null {
  const grouped = new Map<string, { whole: string | null; chunks: Map<number, string> }>();

  for (const cookie of cookies) {
    const match = cookie.name.match(AUTH_COOKIE_NAME);
    if (!match) continue;
    const baseName = match[1];
    const chunkIndex = match[2];
    const entry = grouped.get(baseName) ?? { whole: null, chunks: new Map<number, string>() };
    if (chunkIndex != null) {
      entry.chunks.set(Number(chunkIndex), cookie.value);
    } else {
      entry.whole = cookie.value;
    }
    grouped.set(baseName, entry);
  }

  for (const entry of grouped.values()) {
    if (entry.chunks.size > 0) {
      return [...entry.chunks.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([, value]) => value)
        .join("");
    }
    if (entry.whole) return entry.whole;
  }

  return null;
}

export function parseSupabaseAuthSession(raw: string): {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
} | null {
  const encoded = raw.startsWith("base64-") ? raw.slice("base64-".length) : raw;
  try {
    const json = decodeBase64Url(encoded);
    const parsed = JSON.parse(json) as {
      access_token?: string;
      refresh_token?: string;
      expires_at?: number;
    };
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    try {
      return JSON.parse(raw) as {
        access_token?: string;
        refresh_token?: string;
        expires_at?: number;
      };
    } catch {
      return null;
    }
  }
}

export function shouldRefreshAuthCookies(
  cookies: readonly CookiePair[],
  nowMs = Date.now(),
  skewMs = ACCESS_TOKEN_REFRESH_SKEW_MS,
): AuthCookieRefreshDecision {
  const raw = collectSupabaseAuthCookieValue(cookies);
  if (!raw) return { refresh: false, reason: "no-cookie" };

  const session = parseSupabaseAuthSession(raw);
  if (!session) return { refresh: true, reason: "unreadable-session" };
  if (!session.refresh_token) return { refresh: false, reason: "missing-refresh-token" };
  if (!session.access_token) return { refresh: true, reason: "missing-access-token" };

  const expSeconds =
    decodeJwtExp(session.access_token) ??
    (typeof session.expires_at === "number" ? session.expires_at : null);
  if (expSeconds == null) return { refresh: true, reason: "invalid-access-token" };

  const remainingMs = expSeconds * 1000 - nowMs;
  if (remainingMs <= 0) return { refresh: true, reason: "expired" };
  if (remainingMs <= skewMs) return { refresh: true, reason: "near-expiry" };
  return { refresh: false, reason: "valid" };
}
