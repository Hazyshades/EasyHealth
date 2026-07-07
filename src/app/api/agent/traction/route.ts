import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGENT_SERVICES } from "@/lib/agent-services";

const AGENT_ENDPOINTS = new Set(AGENT_SERVICES.map((s) => s.path));

export async function GET() {
  const supabase = createAdminClient();
  const { data: receipts, error } = await supabase
    .from("payment_receipts")
    .select("endpoint, payer, amount_usdc, gateway_tx, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const agentReceipts = (receipts ?? []).filter((r) => AGENT_ENDPOINTS.has(r.endpoint));

  let totalVolume = 0;
  const byEndpoint: Record<string, number> = {};
  const payers = new Set<string>();
  let settleTxCount = 0;

  for (const row of agentReceipts) {
    const amount = parseFloat(row.amount_usdc ?? "0");
    if (!Number.isNaN(amount)) totalVolume += amount;
    byEndpoint[row.endpoint] = (byEndpoint[row.endpoint] ?? 0) + 1;
    if (row.payer) payers.add(row.payer.toLowerCase());
    if (row.gateway_tx) settleTxCount += 1;
  }

  const byTier: Record<string, number> = {};
  for (const service of AGENT_SERVICES) {
    byTier[service.tier] = (byTier[service.tier] ?? 0) + (byEndpoint[service.path] ?? 0);
  }

  return NextResponse.json({
    total_usdc_volume: totalVolume,
    total_calls: agentReceipts.length,
    unique_payers: payers.size,
    settle_tx_count: settleTxCount,
    calls_by_endpoint: byEndpoint,
    calls_by_tier: byTier,
    recent: agentReceipts.slice(0, 20),
  });
}
