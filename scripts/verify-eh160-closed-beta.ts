import assert from "node:assert/strict";
import { assistantAccessFromProfile } from "../src/lib/assistant/access";
import { buildSyntheticAssistantExample } from "../src/lib/assistant/examples";
import type { ProfileRow } from "../src/lib/auth/profile";

const baseProfile: ProfileRow = {
  id: "00000000-0000-4000-8000-000000160001",
  display_name: "Beta tester",
  first_name: "Beta",
  last_name: "Tester",
  email: "beta@example.test",
  ai_provider: "openai",
  created_at: "2026-01-01T00:00:00.000Z",
  terms_version: "2026-06-29",
  terms_accepted_at: "2026-01-01T00:00:00.000Z",
  health_data_consent_at: "2026-01-01T00:00:00.000Z",
  ai_consent_at: "2026-01-01T00:00:00.000Z",
  consent_preferences: {},
  onboarding_dismissed_at: "2026-01-01T00:00:00.000Z",
  onboarding_completed_at: "2026-01-01T00:00:00.000Z",
  onboarding_tour_version: "2026-01",
  dashboard_preferences: {},
  lab_unit_system: "si",
  review_mode_default: "pro",
  closed_beta_enabled: true,
  closed_beta_enabled_at: "2026-01-01T00:00:00.000Z",
  closed_beta_revoked_at: null,
  beta_sample_data_seeded_at: null,
};

assert.equal(assistantAccessFromProfile({ ...baseProfile, closed_beta_enabled: false }).allowed, false);
assert.equal(
  assistantAccessFromProfile({ ...baseProfile, closed_beta_revoked_at: "2026-01-02T00:00:00.000Z" }).allowed,
  false,
);
assert.equal(
  assistantAccessFromProfile({ ...baseProfile, ai_consent_at: null }).reason,
  "consent_required",
);
assert.equal(assistantAccessFromProfile(baseProfile).allowed, true);

const example = buildSyntheticAssistantExample(baseProfile.id, "00000000-0000-4000-8000-000000160101");
assert.equal(example.citations[0]?.source_kind, "synthetic_example");
assert.equal(example.coverage.personal_claims, 0);
assert.match(example.answer, /synthetic example/i);

console.log("EH-160 closed-beta onboarding verification passed");
