import { createAdminClient } from "@/lib/supabase/admin";
import { ENTITLEMENT_HEADER } from "@/lib/payment-entitlement-contract";

export { ENTITLEMENT_HEADER };
export type { EntitlementRetryResponse } from "@/lib/payment-entitlement-contract";

export type PaymentEntitlementRow = {
  id: string;
  profile_id: string;
  endpoint: string;
  receipt_id: string;
  status: string;
  expires_at: string;
};

export async function markReceiptConsumed(receiptId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("payment_receipts").update({ status: "consumed" }).eq("id", receiptId);
}

export async function markReceiptFailed(receiptId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("payment_receipts").update({ status: "failed" }).eq("id", receiptId);
}

export async function createEntitlement(
  profileId: string,
  endpoint: string,
  receiptId: string
): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_entitlements")
    .insert({
      profile_id: profileId,
      endpoint,
      receipt_id: receiptId,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create payment entitlement");
  }

  return { id: data.id };
}

export async function validateEntitlement(
  entitlementId: string,
  profileId: string,
  endpoint: string
): Promise<{ valid: true; entitlement: PaymentEntitlementRow } | { valid: false }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_entitlements")
    .select("id, profile_id, endpoint, receipt_id, status, expires_at")
    .eq("id", entitlementId)
    .maybeSingle();

  if (error || !data) return { valid: false };
  if (data.profile_id !== profileId) return { valid: false };
  if (data.endpoint !== endpoint) return { valid: false };
  if (data.status !== "available") return { valid: false };
  if (new Date(data.expires_at) <= new Date()) return { valid: false };

  return { valid: true, entitlement: data };
}

export async function redeemEntitlement(entitlementId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("payment_entitlements")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", entitlementId)
    .eq("status", "available")
    .select("id")
    .maybeSingle();

  return !error && !!data;
}
