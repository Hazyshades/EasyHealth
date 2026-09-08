import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { profileOnboardingStateFromRow } from "../src/lib/auth/onboarding-state";
import { resolveAuthCallbackPath } from "../src/lib/auth/callback-redirect";
import type { ProfileRow } from "../src/lib/auth/profile";

const CURRENT_TERMS_VERSION = "2026-06-29";
const CURRENT_TOUR_VERSION = "1";

const baseProfile: ProfileRow = {
  id: "profile-1",
  display_name: "Test User",
  first_name: "Test",
  last_name: "User",
  email: "test@example.com",
  ai_provider: "openai",
  created_at: "2026-01-01T00:00:00.000Z",
  terms_accepted_at: "2026-01-01T00:00:00.000Z",
  terms_version: CURRENT_TERMS_VERSION,
  health_data_consent_at: "2026-01-01T00:00:00.000Z",
  ai_consent_at: "2026-01-01T00:00:00.000Z",
  consent_preferences: {},
  onboarding_dismissed_at: null,
  onboarding_completed_at: null,
  onboarding_tour_version: CURRENT_TOUR_VERSION,
  dashboard_preferences: {},
  lab_unit_system: "si",
};

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return { ...baseProfile, ...overrides };
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function testConsentReadiness(): void {
  const partial = profile({ ai_consent_at: null });
  const partialState = profileOnboardingStateFromRow(partial);
  assert.equal(partialState.needsConsentGate, true);
  assert.equal(partialState.showPlatformTour, false);

  const stale = profile({ terms_version: "2025-01-01" });
  const staleState = profileOnboardingStateFromRow(stale);
  assert.equal(staleState.hasRequiredConsents, true);
  assert.equal(staleState.hasCurrentTerms, false);
  assert.equal(staleState.needsConsentGate, true);

  const readyState = profileOnboardingStateFromRow(profile());
  assert.equal(readyState.needsConsentGate, false);
  assert.equal(readyState.showPlatformTour, true);
  assert.equal(readyState.showSuccessBanner, false);
}

function testTourVersionTransitions(): void {
  const dismissed = profile({
    onboarding_dismissed_at: "2026-01-02T00:00:00.000Z",
  });
  assert.equal(profileOnboardingStateFromRow(dismissed).showPlatformTour, false);

  const completed = profile({
    onboarding_completed_at: "2026-01-02T00:00:00.000Z",
  });
  const completedState = profileOnboardingStateFromRow(completed);
  assert.equal(completedState.showPlatformTour, false);
  assert.equal(completedState.showSuccessBanner, true);

  const previousVersion = profile({
    onboarding_completed_at: "2026-01-02T00:00:00.000Z",
    onboarding_tour_version: "0",
  });
  assert.equal(profileOnboardingStateFromRow(previousVersion).showPlatformTour, true);
}

function testSafeCallbackReasons(): void {
  assert.equal(
    resolveAuthCallbackPath({
      hasCode: true,
      exchangeFailed: true,
      userId: null,
      ensureFailed: false,
      next: "/app",
      needsProfileGate: false,
      needsConsentGate: false,
    }),
    "/?signin=error&reason=auth-exchange",
  );
  assert.equal(
    resolveAuthCallbackPath({
      hasCode: true,
      exchangeFailed: false,
      userId: "user-1",
      ensureFailed: true,
      next: "/app",
      needsProfileGate: false,
      needsConsentGate: false,
    }),
    "/?signin=error&reason=profile-setup",
  );
}

function testSourceContracts(): void {
  const consentPage = readRepo("src/app/onboarding/consent/page.tsx");
  assert.match(consentPage, /terms: false/);
  assert.match(consentPage, /privacy: false/);
  assert.match(consentPage, /health_data: false/);
  assert.match(consentPage, /ai_processing: false/);
  assert.match(consentPage, /analytics: false/);
  assert.match(consentPage, /marketing_cookies: false/);
  assert.match(consentPage, /data\.onboarding\?\.needsConsentGate/);

  const tour = readRepo("src/components/onboarding/platform-tour.tsx");
  assert.match(tour, /prefers-reduced-motion/);
  assert.match(tour, /allowKeyboardControl: true/);
  assert.match(tour, /skipMissingElement: true/);
  assert.match(tour, /eh-platform-tour-skip-btn/);
  assert.match(tour, /textContent = "Skip"/);
  const stepsStart = tour.indexOf("const steps: Array<DriveStep | null> = [");
  const stepsSource = tour.slice(stepsStart, tour.indexOf("  ];", stepsStart));
  assert.ok(stepsSource.indexOf("PLATFORM_TOUR_TARGETS.reports") < stepsSource.indexOf("biomarkersSelector"));
  assert.ok(stepsSource.indexOf("biomarkersSelector") < stepsSource.indexOf("PLATFORM_TOUR_TARGETS.healthProfile"));

  const authProvider = readRepo("src/components/auth-provider.tsx");
  assert.match(authProvider, /profileStatus/);
  assert.match(authProvider, /authUserId/);
  assert.doesNotMatch(authProvider, /setProfileId\(user\.id\)/);

  const migration = readRepo("supabase/migrations/077_platform_tour.sql");
  assert.match(migration, /onboarding_tour_version text not null default '1'/);

  const sourceFiles = [
    "src/app/api/profile/route.ts",
    "src/app/app/page.tsx",
    "src/lib/auth/profile.ts",
    "src/lib/onboarding/platform-tour.ts",
  ];
  for (const file of sourceFiles) {
    assert.doesNotMatch(readRepo(file), /wizard_step_visited|dismiss_wizard|complete_wizard/);
  }
}

function main(): void {
  testConsentReadiness();
  testTourVersionTransitions();
  testSafeCallbackReasons();
  testSourceContracts();
  console.log("verify-user-onboarding-platform-tour: all checks passed");
}

main();
