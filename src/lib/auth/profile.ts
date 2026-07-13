import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiProviderId } from "@/lib/ai-provider";
import {
  CURRENT_TERMS_VERSION,
  extractConsentPreferences,
  type ConsentPayload,
  validateRequiredConsents,
} from "@/lib/consent";
import { WIZARD_STEP_IDS, type WizardStepId } from "@/lib/onboarding/wizard-steps";
import { resolveProfileIdentity } from "@/lib/display-name";

export type DashboardPreferences = {
  banner_dismissed_at?: string;
  widget_order?: string[];
  hidden_widgets?: string[];
  wizard_steps_visited?: string[];
};

export type LabUnitSystem = "us" | "si";

export type ProfileRow = {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  ai_provider: AiProviderId;
  created_at: string;
  terms_accepted_at: string | null;
  terms_version: string | null;
  health_data_consent_at: string | null;
  ai_consent_at: string | null;
  consent_preferences: Record<string, boolean>;
  onboarding_dismissed_at: string | null;
  onboarding_completed_at: string | null;
  dashboard_preferences: DashboardPreferences;
  lab_unit_system: LabUnitSystem;
};

const PROFILE_SELECT =
  "id, display_name, first_name, last_name, email, ai_provider, created_at, terms_accepted_at, terms_version, health_data_consent_at, ai_consent_at, consent_preferences, onboarding_dismissed_at, onboarding_completed_at, dashboard_preferences, lab_unit_system";

function mapProfileRow(data: Record<string, unknown>): ProfileRow {
  const unit = data.lab_unit_system;
  return {
    id: data.id as string,
    display_name: (data.display_name as string | null) ?? null,
    first_name: (data.first_name as string | null) ?? null,
    last_name: (data.last_name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    ai_provider: ((data.ai_provider as AiProviderId | null) ?? "openai") as AiProviderId,
    created_at: data.created_at as string,
    terms_accepted_at: (data.terms_accepted_at as string | null) ?? null,
    terms_version: (data.terms_version as string | null) ?? null,
    health_data_consent_at: (data.health_data_consent_at as string | null) ?? null,
    ai_consent_at: (data.ai_consent_at as string | null) ?? null,
    consent_preferences: (data.consent_preferences as Record<string, boolean>) ?? {},
    onboarding_dismissed_at: (data.onboarding_dismissed_at as string | null) ?? null,
    onboarding_completed_at: (data.onboarding_completed_at as string | null) ?? null,
    dashboard_preferences: (data.dashboard_preferences as DashboardPreferences) ?? {},
    lab_unit_system: unit === "us" || unit === "si" ? unit : "si",
  };
}

export function buildDisplayName(firstName: string, lastName?: string | null): string {
  const first = firstName.trim();
  const last = lastName?.trim();
  return last ? `${first} ${last}` : first;
}

/**
 * Ensure a public.profiles row exists for the Supabase Auth user.
 * profiles.id = auth.users.id. Idempotent.
 */
export async function ensureProfile(user: User): Promise<string> {
  const supabase = createAdminClient();
  const email = user.email?.trim() || null;
  const metaName =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name) ||
    null;
  const identity = resolveProfileIdentity(metaName, email);

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    if (email && email !== existing.email) {
      await supabase.from("profiles").update({ email }).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email,
      display_name: identity.firstName,
      // first_name left null so onboarding profile gate still runs unless set later
    })
    .select("id")
    .single();

  if (error) {
    // Race: concurrent ensure may hit unique id
    const { data: raced } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (raced?.id) return raced.id as string;
    throw error;
  }

  return data.id as string;
}

export async function getProfileById(profileId: string): Promise<ProfileRow> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function updateProfileDisplayName(profileId: string, displayName: string) {
  const supabase = createAdminClient();
  const trimmed = displayName.trim();
  if (!trimmed) {
    throw new Error("Name is required");
  }
  const firstName = trimmed.split(/\s+/)[0] ?? trimmed;

  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: firstName, first_name: firstName })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function updateProfileName(
  profileId: string,
  firstName: string,
  lastName?: string | null
) {
  const supabase = createAdminClient();
  const first = firstName.trim();
  if (!first) {
    throw new Error("First name is required");
  }
  const last = lastName?.trim() || null;
  const displayName = buildDisplayName(first, last);

  const { data, error } = await supabase
    .from("profiles")
    .update({
      first_name: first,
      last_name: last,
      display_name: displayName,
    })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function recordProfileConsents(profileId: string, consents: ConsentPayload) {
  if (!validateRequiredConsents(consents)) {
    throw new Error("All required consents must be accepted");
  }

  const now = new Date().toISOString();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      terms_accepted_at: now,
      health_data_consent_at: now,
      ai_consent_at: now,
      terms_version: CURRENT_TERMS_VERSION,
      consent_preferences: extractConsentPreferences(consents),
    })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function updateOnboardingWizardState(
  profileId: string,
  action: "dismiss_wizard" | "complete_wizard" | "dismiss_banner"
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  if (action === "dismiss_wizard") {
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_dismissed_at: now })
      .eq("id", profileId)
      .select(PROFILE_SELECT)
      .single();
    if (error) throw error;
    return mapProfileRow(data as Record<string, unknown>);
  }

  if (action === "complete_wizard") {
    const { data, error } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: now })
      .eq("id", profileId)
      .select(PROFILE_SELECT)
      .single();
    if (error) throw error;
    return mapProfileRow(data as Record<string, unknown>);
  }

  const profile = await getProfileById(profileId);
  const preferences: DashboardPreferences = {
    ...profile.dashboard_preferences,
    banner_dismissed_at: now,
  };
  const { data, error } = await supabase
    .from("profiles")
    .update({ dashboard_preferences: preferences })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function markWizardStepVisited(profileId: string, stepId: WizardStepId) {
  if (!WIZARD_STEP_IDS.includes(stepId)) {
    throw new Error("Invalid wizard step");
  }

  const profile = await getProfileById(profileId);
  const visited = new Set(profile.dashboard_preferences?.wizard_steps_visited ?? []);
  visited.add(stepId);

  const preferences: DashboardPreferences = {
    ...profile.dashboard_preferences,
    wizard_steps_visited: [...visited],
  };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ dashboard_preferences: preferences })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function updateProfileLabUnitSystem(
  profileId: string,
  labUnitSystem: LabUnitSystem
) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ lab_unit_system: labUnitSystem })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}

export async function updateProfileAiProvider(profileId: string, aiProvider: AiProviderId) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ai_provider: aiProvider })
    .eq("id", profileId)
    .select(PROFILE_SELECT)
    .single();
  if (error) throw error;
  return mapProfileRow(data as Record<string, unknown>);
}
