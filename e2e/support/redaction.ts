const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "apikey",
  "authorization",
  "code",
  "email_otp",
  "refresh_token",
  "sb",
  "service_role",
  "token",
  "token_hash",
]);

const VALUE_PATTERNS: RegExp[] = [
  /(Bearer\s+)[^\s"']+/gi,
  /(authorization\s*[:=]\s*)[^\s"']+/gi,
  /(apikey\s*[:=]\s*)[^\s"']+/gi,
  /(SUPABASE_SERVICE_ROLE_KEY\s*[=:]\s*)[^\s"']+/gi,
  /(NEXT_PUBLIC_SUPABASE_ANON_KEY\s*[=:]\s*)[^\s"']+/gi,
];

export function redactSensitive(value: string): string {
  let redacted = value;
  for (const pattern of VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, "$1[REDACTED]");
  }

  return redacted.replace(/https?:\/\/[^\s"']+/gi, (candidate) => {
    try {
      const url = new URL(candidate);
      redactParameters(url.searchParams);

      const fragment = url.hash.slice(1);
      const fragmentParameters = new URLSearchParams(fragment);
      if (redactParameters(fragmentParameters)) {
        url.hash = fragmentParameters.toString();
      }
      return url.toString();
    } catch {
      return candidate;
    }
  });
}

function redactParameters(parameters: URLSearchParams): boolean {
  let changed = false;
  for (const key of [...parameters.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      parameters.set(key, "[REDACTED]");
      changed = true;
    }
  }
  return changed;
}

export function safeE2EError(operation: string, error: unknown): Error {
  const message = safeErrorMessage(error);
  return new Error(`${operation}: ${redactSensitive(message)}`);
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const details = Object.fromEntries(
      ["message", "code", "details", "hint"]
        .filter((key) => record[key] != null)
        .map((key) => [key, record[key]]),
    );
    if (Object.keys(details).length > 0) return JSON.stringify(details);
    try {
      return JSON.stringify(error);
    } catch {
      return "structured error";
    }
  }
  return String(error);
}
