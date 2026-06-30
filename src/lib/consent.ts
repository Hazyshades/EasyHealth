export const CURRENT_TERMS_VERSION = "2026-06-29";

export type ConsentPreferences = {
  analytics?: boolean;
  personalization?: boolean;
  marketing_email?: boolean;
  marketing_cookies?: boolean;
};

export type RequiredConsents = {
  terms: boolean;
  privacy: boolean;
  health_data: boolean;
  ai_processing: boolean;
};

export type ConsentPayload = RequiredConsents & ConsentPreferences;

export function validateRequiredConsents(consents: RequiredConsents): boolean {
  return (
    consents.terms === true &&
    consents.privacy === true &&
    consents.health_data === true &&
    consents.ai_processing === true
  );
}

export function extractConsentPreferences(consents: ConsentPayload): ConsentPreferences {
  return {
    analytics: consents.analytics ?? false,
    personalization: consents.personalization ?? false,
    marketing_email: consents.marketing_email ?? false,
    marketing_cookies: consents.marketing_cookies ?? false,
  };
}
