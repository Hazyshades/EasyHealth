import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  getProfileById,
  markWizardStepVisited,
  recordProfileConsents,
  updateOnboardingWizardState,
  updateProfileAiProvider,
  updateProfileDisplayName,
  updateProfileName,
  type ProfileRow,
} from "@/lib/auth/profile";
import { WIZARD_STEP_IDS } from "@/lib/onboarding/wizard-steps";
import {
  isProviderConfigured,
  providerAvailability,
  type AiProviderId,
} from "@/lib/ai-provider";

const consentsSchema = z.object({
  terms: z.literal(true),
  privacy: z.literal(true),
  health_data: z.literal(true),
  ai_processing: z.literal(true),
  analytics: z.boolean().optional(),
  personalization: z.boolean().optional(),
  marketing_email: z.boolean().optional(),
  marketing_cookies: z.boolean().optional(),
});

const patchSchema = z
  .object({
    ai_provider: z.enum(["openai", "deepseek", "owl_alpha", "nebius_fast", "nebius_quality"]).optional(),
    display_name: z.string().trim().min(1).max(120).optional(),
    first_name: z.string().trim().min(1).max(60).optional(),
    last_name: z.string().trim().max(60).nullable().optional(),
    consents: consentsSchema.optional(),
    onboarding_action: z
      .enum(["dismiss_wizard", "complete_wizard", "dismiss_banner"])
      .optional(),
    wizard_step_visited: z.enum(WIZARD_STEP_IDS).optional(),
    api_key: z.unknown().optional(),
    base_url: z.unknown().optional(),
  })
  .strict();

function profileResponse(profile: ProfileRow) {
  return {
    id: profile.id,
    wallet_address: profile.wallet_address,
    display_name: profile.display_name,
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    ai_provider: profile.ai_provider,
    created_at: profile.created_at,
    terms_accepted_at: profile.terms_accepted_at,
    terms_version: profile.terms_version,
    health_data_consent_at: profile.health_data_consent_at,
    ai_consent_at: profile.ai_consent_at,
    consent_preferences: profile.consent_preferences,
    onboarding_dismissed_at: profile.onboarding_dismissed_at,
    onboarding_completed_at: profile.onboarding_completed_at,
    dashboard_preferences: profile.dashboard_preferences,
    wizard_steps_visited: profile.dashboard_preferences?.wizard_steps_visited ?? [],
    ...providerAvailability(),
  };
}

function providerUnavailableMessage(provider: AiProviderId): string {
  if (provider === "deepseek") {
    return "DeepSeek is temporarily unavailable. Try ChatGPT or contact support.";
  }
  if (provider === "owl_alpha") {
    return "Tencent Hy3 is temporarily unavailable. Try ChatGPT or contact support.";
  }
  if (provider === "nebius_fast" || provider === "nebius_quality") {
    return "Nebius is temporarily unavailable. Try ChatGPT or contact support.";
  }
  return "This AI provider is not available.";
}

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await getProfileById(profileId);
    return NextResponse.json(profileResponse(profile));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.api_key !== undefined || parsed.data.base_url !== undefined) {
    return NextResponse.json(
      { error: "Custom API keys and URLs are not supported" },
      { status: 400 }
    );
  }

  const hasUpdate =
    parsed.data.ai_provider ||
    parsed.data.display_name ||
    parsed.data.first_name ||
    parsed.data.consents ||
    parsed.data.onboarding_action ||
    parsed.data.wizard_step_visited;

  if (!hasUpdate) {
    return NextResponse.json({ error: "No supported fields to update" }, { status: 400 });
  }

  if (parsed.data.ai_provider && !isProviderConfigured(parsed.data.ai_provider)) {
    return NextResponse.json(
      { error: providerUnavailableMessage(parsed.data.ai_provider) },
      { status: 503 }
    );
  }

  try {
    let profile = await getProfileById(profileId);

    if (parsed.data.first_name) {
      profile = await updateProfileName(
        profileId,
        parsed.data.first_name,
        parsed.data.last_name ?? null
      );
    } else if (parsed.data.display_name) {
      profile = await updateProfileDisplayName(profileId, parsed.data.display_name);
    }

    if (parsed.data.consents) {
      profile = await recordProfileConsents(profileId, parsed.data.consents);
    }

    if (parsed.data.onboarding_action) {
      profile = await updateOnboardingWizardState(profileId, parsed.data.onboarding_action);
    }

    if (parsed.data.wizard_step_visited) {
      profile = await markWizardStepVisited(profileId, parsed.data.wizard_step_visited);
    }

    if (parsed.data.ai_provider) {
      profile = await updateProfileAiProvider(profileId, parsed.data.ai_provider);
    }

    return NextResponse.json(profileResponse(profile));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    const status = message.includes("consents") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
