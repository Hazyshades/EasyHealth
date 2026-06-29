import { createAdminClient } from "@/lib/supabase/admin";
import type { AiProviderId } from "@/lib/ai-provider";

export type ProfileRow = {
  id: string;
  wallet_address: string;
  circle_wallet_id: string | null;
  display_name: string | null;
  email: string | null;
  ai_provider: AiProviderId;
  created_at: string;
};

type UpsertProfileOptions = {
  circleWalletId?: string;
  displayName?: string | null;
  email?: string | null;
};

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
    .select("id, wallet_address, circle_wallet_id, display_name, email, ai_provider, created_at")
    .eq("id", profileId)
    .single();
  if (error) throw error;
  return {
    ...data,
    email: (data.email as string | null) ?? null,
    ai_provider: (data.ai_provider as AiProviderId | null) ?? "openai",
  };
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
    .update({ display_name: firstName })
    .eq("id", profileId)
    .select("id, wallet_address, circle_wallet_id, display_name, email, ai_provider, created_at")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function updateProfileAiProvider(profileId: string, aiProvider: AiProviderId) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ai_provider: aiProvider })
    .eq("id", profileId)
    .select("id, wallet_address, circle_wallet_id, display_name, email, ai_provider, created_at")
    .single();
  if (error) throw error;
  return data as ProfileRow;
}
