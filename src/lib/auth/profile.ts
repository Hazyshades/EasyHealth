import { createAdminClient } from "@/lib/supabase/admin";

export async function upsertProfileByWallet(walletAddress: string, circleWalletId?: string) {
  const supabase = createAdminClient();
  const normalized = walletAddress.toLowerCase();

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("wallet_address", normalized)
    .maybeSingle();

  if (existing) {
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      wallet_address: normalized,
      circle_wallet_id: circleWalletId ?? null,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function getProfileById(profileId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (error) throw error;
  return data;
}
