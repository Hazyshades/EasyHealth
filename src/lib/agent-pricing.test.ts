import assert from "node:assert/strict";
import { priceAgentRequest, suggestTierForItemCount } from "@/lib/agent-pricing";
import type { AgentInsightRequest } from "@/lib/schemas/agent-request";

function sampleBody(biomarkerCount: number, options?: AgentInsightRequest["options"]): AgentInsightRequest {
  const biomarkers = Array.from({ length: biomarkerCount }, (_, i) => ({
    biomarker: `Test ${i}`,
    key: `test_${i}`,
    value: 5 + i,
    unit: "mg/dL",
    ref_low: 3,
    ref_high: 7,
    observed_at: "2026-05-01",
    source: "agent",
  }));

  return { data: { biomarkers, instrumental_findings: [], consultation_notes: [], discharge_summaries: [], prescriptions: [], referrals: [], document_summaries: [], source_document_ids: [] }, options };
}

// Base price for minimal quick-insight
{
  const quote = priceAgentRequest("quick-insight", sampleBody(2));
  assert.equal(quote.breakdown.base, 0.003);
  assert.equal(quote.breakdown.per_item, 0);
  assert.equal(quote.amountUsdcMicro, 3000);
}

// Per-item surcharge beyond free quota (basic freeQuota = 3)
{
  const quote = priceAgentRequest("quick-insight", sampleBody(5));
  assert.equal(quote.breakdown.per_item, 0.001); // 2 extra * 0.0005
  assert.equal(quote.amountUsdcMicro, 4000);
}

// Feature flags on clinician-summary
{
  const quote = priceAgentRequest(
    "clinician-summary",
    sampleBody(1, { include_citations: true, depth: "deep" })
  );
  assert.equal(quote.breakdown.features, 0.03);
  assert.equal(quote.breakdown.base, 0.05);
}

// Cap applied on pro tier
{
  const quote = priceAgentRequest(
    "clinician-summary",
    sampleBody(200, { include_citations: true, depth: "deep" })
  );
  assert.equal(quote.breakdown.cap_applied, true);
  assert.equal(quote.amountUsdcMicro, 150_000);
}

// Tier degradation suggestion
{
  assert.equal(suggestTierForItemCount(1, "pro"), "basic");
  assert.equal(suggestTierForItemCount(5, "pro"), undefined);
}

console.log("agent-pricing tests passed");
