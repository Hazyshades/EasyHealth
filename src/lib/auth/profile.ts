import { createAdminClient } from "@/lib/supabase/admin";
import type { AiProviderId } from "@/lib/ai-provider";
import {
  CURRENT_TERMS_VERSION,
  extractConsentPreferences,
  type ConsentPayload,
  validateRequiredConsents,
} from "@/lib/consent";
import { WIZARD_STEP_IDS, type WizardStepId } from "@/lib/onboarding/wizard-steps";

export type DashboardPreferences = {
  banner_dismissed_at?: string;
  widget_order?: string[];
  hidden_widgets?: string[];
  wizard_steps_visited?: string[];
};

export type ProfileRow = {
  id: string;
  wallet_address: string;
  circle_wallet_id: string | null;
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
};

const PROFILE_SELECT =
  "id, wallet_address, circle_wallet_id, display_name, first_name, last_name, email, ai_provider, created_at, terms_accepted_at, terms_version, health_data_consent_at, ai_consent_at, consent_preferences, onboarding_dismissed_at, onboarding_completed_at, dashboard_preferences";

type UpsertProfileOptions = {
  circleWalletId?: string;
  displayName?: string | null;
  email?: string | null;
};

function mapProfileRow(data: Record<string, unknown>): ProfileRow {
  return {
    id: data.id as string,
    wallet_address: data.wallet_address as string,
    circle_wallet_id: (data.circle_wallet_id as string | null) ?? null,
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
  };
}

export function buildDisplayName(firstName: string, lastName?: string | null): string {
  const first = firstName.trim();
  const last = lastName?.trim();
  return last ? `${first} ${last}` : first;
}

export async function upsertProfileByWallet(
  walletAddress: string,
  options?: UpsertProfileOptions
) {
  const supabase = createAdminClient();
  const normalized = walletAddress.toLowerCase();
  const displayName =
    options && "displayName" in options ? options.displayName?.trim() || null : undefined;
  const email = options?.email?.trim() || null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("wallet_address", normalized)
    .maybeSingle();

  if (existing) {
    const updates: Record<string, string | null> = {};
    if (displayName !== undefined && displayName !== existing.display_name) {
      updates.display_name = displayName;
    }
    if (email && email !== existing.email) {
      updates.email = email;
    }
    if (options?.circleWalletId) {
      updates.circle_wallet_id = options.circleWalletId;
    }
    if (Object.keys(updates).length > 0) {
      await supabase.from("profiles").update(updates).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      wallet_address: normalized,
      circle_wallet_id: options?.circleWalletId ?? null,
      display_name: displayName ?? null,
      email,
    })
    .select("id")
    .single();

  if (error) throw error;
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
