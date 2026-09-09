export type AuthCallbackFailureReason =
  | "missing-code"
  | "auth-exchange"
  | "profile-setup"
  | "auth-user-missing";

export function resolveAuthCallbackPath(input: {
  hasCode: boolean;
  exchangeFailed: boolean;
  userId: string | null;
  ensureFailed: boolean;
  next: string | null;
  needsProfileGate: boolean;
  needsConsentGate: boolean;
}): string {
  if (!input.hasCode) return "/?signin=error&reason=missing-code";
  if (input.exchangeFailed) return "/?signin=error&reason=auth-exchange";
  if (input.ensureFailed) return "/?signin=error&reason=profile-setup";
  if (!input.userId) return "/?signin=error&reason=auth-user-missing";
  if (input.next && input.next.startsWith("/") && !input.next.startsWith("//")) {
    return input.next;
  }
  if (input.needsProfileGate) return "/onboarding/profile";
  if (input.needsConsentGate) return "/onboarding/consent";
  return "/app";
}

export function getAuthCallbackErrorMessage(reason: string | null): string {
  switch (reason) {
    case "auth-exchange":
      return "That sign-in link is invalid or expired. Request a new link to continue.";
    case "profile-setup":
      return "We signed you in, but could not prepare your health profile. Try again or contact support.";
    case "missing-code":
    case "auth-user-missing":
    default:
      return "We could not complete sign-in. Try again or request a new link.";
  }
}
