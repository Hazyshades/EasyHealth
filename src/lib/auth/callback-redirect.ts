export function resolveAuthCallbackPath(input: {
  hasCode: boolean;
  exchangeError: string | null;
  userId: string | null;
  ensureFailed: boolean;
  next: string | null;
  needsProfileGate: boolean;
  needsConsentGate: boolean;
}): string {
  if (!input.hasCode) return "/?signin=error";
  if (input.exchangeError) {
    return `/?signin=error&message=${encodeURIComponent(input.exchangeError)}`;
  }
  if (!input.userId || input.ensureFailed) return "/?signin=error";
  if (input.next && input.next.startsWith("/") && !input.next.startsWith("//")) {
    return input.next;
  }
  if (input.needsProfileGate) return "/onboarding/profile";
  if (input.needsConsentGate) return "/onboarding/consent";
  return "/app";
}
