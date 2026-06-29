import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  getProfileById,
  updateProfileAiProvider,
  updateProfileDisplayName,
} from "@/lib/auth/profile";
import {
  isProviderConfigured,
  providerAvailability,
  type AiProviderId,
} from "@/lib/ai-provider";

const patchSchema = z
  .object({
    ai_provider: z.enum(["openai", "deepseek", "owl_alpha"]).optional(),
    display_name: z.string().trim().min(1).max(120).optional(),
    api_key: z.unknown().optional(),
    base_url: z.unknown().optional(),
  })
  .strict();

function profileResponse(profile: Awaited<ReturnType<typeof getProfileById>>) {
  return {
    id: profile.id,
    wallet_address: profile.wallet_address,
    display_name: profile.display_name,
    email: profile.email,
    ai_provider: profile.ai_provider,
    created_at: profile.created_at,
    ...providerAvailability(),
  };
}

function providerUnavailableMessage(provider: AiProviderId): string {
  if (provider === "deepseek") {
    return "DeepSeek is temporarily unavailable. Try ChatGPT or contact support.";
  }
  if (provider === "owl_alpha") {
    return "Owl Alpha is temporarily unavailable. Try ChatGPT or contact support.";
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

  if (!parsed.data.ai_provider && !parsed.data.display_name) {
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

    if (parsed.data.display_name) {
      profile = await updateProfileDisplayName(profileId, parsed.data.display_name);
    }

    if (parsed.data.ai_provider) {
      profile = await updateProfileAiProvider(profileId, parsed.data.ai_provider);
    }

    return NextResponse.json(profileResponse(profile));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
