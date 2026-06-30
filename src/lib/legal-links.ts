export const LEGAL_LINKS = {
  terms: process.env.NEXT_PUBLIC_TERMS_URL ?? "/legal/terms",
  privacy: process.env.NEXT_PUBLIC_PRIVACY_URL ?? "/legal/privacy",
  cookies: process.env.NEXT_PUBLIC_COOKIE_POLICY_URL ?? "/legal/cookies",
} as const;
