import type { AgentInsightRequest } from "@/lib/schemas/agent-request";

export type AgentServiceId =
  | "quick-insight"
  | "trend-analysis"
  | "holistic-synthesis"
  | "clinician-summary";

export type AgentTier = "basic" | "plus" | "pro";

export type PriceBreakdown = {
  base: number;
  per_item: number;
  features: number;
  cap_applied: boolean;
};

export type AgentPriceQuote = {
  amountUsdcMicro: number;
  quoted_price_usdc: string;
  breakdown: PriceBreakdown;
  suggested_tier?: AgentTier;
};

type TierConfig = {
  tier: AgentTier;
  base: number;
  freeQuota: number;
  perItem: number;
  max: number;
  minItemsForTier: number;
};

export const SERVICE_TIER: Record<AgentServiceId, AgentTier> = {
  "quick-insight": "basic",
  "trend-analysis": "plus",
  "holistic-synthesis": "plus",
  "clinician-summary": "pro",
};

const TIER_CONFIG: Record<AgentTier, TierConfig> = {
  basic: { tier: "basic", base: 0.003, freeQuota: 3, perItem: 0.0005, max: 0.01, minItemsForTier: 0 },
  plus: { tier: "plus", base: 0.01, freeQuota: 5, perItem: 0.002, max: 0.05, minItemsForTier: 2 },
  pro: { tier: "pro", base: 0.05, freeQuota: 10, perItem: 0.001, max: 0.15, minItemsForTier: 1 },
};

export const SERVICE_BASE_PRICES: Record<AgentServiceId, number> = {
  "quick-insight": TIER_CONFIG.basic.base,
  "trend-analysis": TIER_CONFIG.plus.base,
  "holistic-synthesis": TIER_CONFIG.plus.base,
  "clinician-summary": TIER_CONFIG.pro.base,
};

function countPricingItems(data: AgentInsightRequest["data"]): number {
  return (
    (data.biomarkers?.length ?? 0) +
    (data.instrumental_findings?.length ?? 0) +
    (data.consultation_notes?.length ?? 0) +
    (data.discharge_summaries?.length ?? 0) +
    (data.prescriptions?.length ?? 0) +
    (data.referrals?.length ?? 0) +
    (data.document_summaries?.length ?? 0)
  );
}

function featureSurcharge(options: AgentInsightRequest["options"]): number {
  let surcharge = 0;
  if (options?.include_citations) surcharge += 0.01;
  if (options?.depth === "deep") surcharge += 0.02;
  if (options?.output_format === "text") surcharge += 0.001;
  return surcharge;
}

function toMicro(usdc: number): number {
  return Math.round(usdc * 1_000_000);
}

function formatUsdc(usdc: number): string {
  return usdc.toFixed(6).replace(/\.?0+$/, "") || "0";
}

export function suggestTierForItemCount(itemCount: number, serviceTier: AgentTier): AgentTier | undefined {
  if (serviceTier === "pro" && itemCount <= 2) return "basic";
  if (serviceTier === "plus" && itemCount <= 1) return "basic";
  return undefined;
}

export function priceAgentRequest(
  serviceId: AgentServiceId,
  body: AgentInsightRequest
): AgentPriceQuote {
  const serviceTier = SERVICE_TIER[serviceId];
  const config = TIER_CONFIG[serviceTier];
  const itemCount = countPricingItems(body.data);
  const extraItems = Math.max(0, itemCount - config.freeQuota);
  const perItemCharge = extraItems * config.perItem;
  const features = featureSurcharge(body.options);
  const raw = config.base + perItemCharge + features;
  const capped = Math.min(raw, config.max);

  return {
    amountUsdcMicro: toMicro(capped),
    quoted_price_usdc: formatUsdc(capped),
    breakdown: {
      base: config.base,
      per_item: perItemCharge,
      features,
      cap_applied: raw > config.max,
    },
    suggested_tier: suggestTierForItemCount(itemCount, serviceTier),
  };
}
