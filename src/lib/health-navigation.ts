const NAVIGATION_ORIGIN = "https://easyhealth.internal";

export const HEALTH_NAVIGATION_KEYS = {
  system: "system",
  measurement: "measurement",
  observation: "observation",
  returnTo: "returnTo",
} as const;

export type HealthNavigationContext = {
  system: string | null;
  measurement: string | null;
  observation: string | null;
  returnTo: string | null;
};

type HealthNavigationValues = Partial<HealthNavigationContext>;

type SearchParamsReader = Pick<URLSearchParams, "get">;

function normalizedParam(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 && normalized.length <= 256 ? normalized : null;
}

function isSafeInternalPath(value: string): boolean {
  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

/** Returns a same-origin relative path or the provided local fallback. */
export function resolveHealthReturnPath(
  value: string | null | undefined,
  fallback: string,
): string {
  const candidate = value?.trim() ?? "";
  if (!candidate || !isSafeInternalPath(candidate)) return fallback;

  try {
    const parsed = new URL(candidate, NAVIGATION_ORIGIN);
    if (parsed.origin !== NAVIGATION_ORIGIN) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/** Builds an internal path while encoding nested return paths exactly once. */
export function buildHealthNavigationPath(
  pathname: string,
  values: HealthNavigationValues = {},
): string {
  const basePath = resolveHealthReturnPath(pathname, "/app");
  const parsed = new URL(basePath, NAVIGATION_ORIGIN);
  const entries: Array<[keyof HealthNavigationContext, string | null | undefined]> = [
    [HEALTH_NAVIGATION_KEYS.system, values.system],
    [HEALTH_NAVIGATION_KEYS.measurement, values.measurement],
    [HEALTH_NAVIGATION_KEYS.observation, values.observation],
    [HEALTH_NAVIGATION_KEYS.returnTo, values.returnTo],
  ];

  for (const [key, rawValue] of entries) {
    const value = normalizedParam(rawValue);
    if (key === HEALTH_NAVIGATION_KEYS.returnTo) {
      if (!value) {
        parsed.searchParams.delete(key);
      } else {
        const safeReturnPath = resolveHealthReturnPath(value, "");
        if (safeReturnPath) parsed.searchParams.set(key, safeReturnPath);
        else parsed.searchParams.delete(key);
      }
      continue;
    }
    if (value) parsed.searchParams.set(key, value);
    else parsed.searchParams.delete(key);
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function readHealthNavigationContext(
  searchParams: SearchParamsReader,
): HealthNavigationContext {
  return {
    system: normalizedParam(searchParams.get(HEALTH_NAVIGATION_KEYS.system)),
    measurement: normalizedParam(searchParams.get(HEALTH_NAVIGATION_KEYS.measurement)),
    observation: normalizedParam(searchParams.get(HEALTH_NAVIGATION_KEYS.observation)),
    returnTo: resolveHealthReturnPath(
      searchParams.get(HEALTH_NAVIGATION_KEYS.returnTo),
      "",
    ) || null,
  };
}

export function healthRouteLabel(path: string): string {
  const safePath = resolveHealthReturnPath(path, "/app");
  const pathname = safePath.split("?", 1)[0]?.split("#", 1)[0] ?? "/app";
  if (pathname === "/app/profile") return "Health Profile";
  if (pathname === "/app/biomarkers") return "Biomarkers";
  if (pathname === "/app/timeline") return "Health Timeline";
  if (pathname === "/app/documents" || pathname.startsWith("/app/documents/")) {
    return "Documents";
  }
  if (pathname === "/app") return "Dashboard";
  return "Back to EasyHealth";
}
