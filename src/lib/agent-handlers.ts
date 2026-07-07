import { NextResponse } from "next/server";
import { resolveAgentModel } from "@/lib/ai-provider";
import { generateDoctorSummary } from "@/lib/generate-doctor-summary";
import { generateHolisticSynthesisText } from "@/lib/holistic-synthesis";
import { buildReportSystemPrompt, SAFETY_PROMPT } from "@/lib/report-prompts";
import {
  mapAgentDataToContext,
  type AgentInsightRequest,
} from "@/lib/schemas/agent-request";
import type { SettledPayment } from "@/lib/x402";
import { buildMultiSourceReportContext, withDisclaimer } from "@/lib/reports";
import type { ObservationRow } from "@/lib/reports";

const QUICK_INSIGHT_SYSTEM = `You are an educational health literacy assistant for EasyHealth.
Provide a brief interpretation of the supplied biomarker values.
Rules:
- Educational language only. NO diagnoses, prescriptions, or treatment plans.
- Cite specific values and dates from the data.
- Keep overview to 2-3 sentences; key_findings to 1-3 bullets.
- changes may note limited history if only one date exists.
- questions_for_clinician: at least 2 practical questions.
- when_to_seek_care: general urgent symptom guidance only.`;

function biomarkersToObservations(
  biomarkers: ReturnType<typeof mapAgentDataToContext>["biomarkers"]
): ObservationRow[] {
  return biomarkers.map((b) => ({
    name: b.biomarker,
    biomarker_key: b.key,
    value: b.value,
    unit: b.unit,
    ref_low: b.ref_low,
    ref_high: b.ref_high,
    observed_at: b.observed_at,
    documents: { original_filename: b.source, observed_at: b.observed_at },
  }));
}

function paymentMeta(payment: SettledPayment) {
  return {
    payer: payment.payer,
    amount_usdc: payment.amountUsdc,
    gateway_tx: payment.gatewayTx,
    network: payment.network,
  };
}

export async function handleQuickInsight(body: AgentInsightRequest, payment: SettledPayment) {
  const context = mapAgentDataToContext(body.data);
  const observations = biomarkersToObservations(context.biomarkers);
  const reportContext = buildMultiSourceReportContext(context, observations, false);

  const model = resolveAgentModel();
  const summary = await generateDoctorSummary({
    model,
    system: QUICK_INSIGHT_SYSTEM,
    prompt: `Interpret these biomarkers for a quick educational insight:\n${JSON.stringify(reportContext, null, 2)}`,
  });

  return NextResponse.json({
    tier: "basic",
    service: "quick-insight",
    result: withDisclaimer(summary),
    usage: { biomarkers: context.biomarkers.length },
    payment_receipt: paymentMeta(payment),
    escalate_recommended: summary.key_findings.some((f) =>
      /borderline|above|below|elevated|high|low|out of range/i.test(f)
    ),
  });
}

export async function handleClinicianSummary(body: AgentInsightRequest, payment: SettledPayment) {
  const context = mapAgentDataToContext(body.data);
  const observations = biomarkersToObservations(context.biomarkers);
  const reportContext = buildMultiSourceReportContext(context, observations, false);
  const depth = body.options?.depth ?? "standard";
  const detailLevel = depth === "deep" ? "detailed" : "standard";

  const model = resolveAgentModel();
  const summary = await generateDoctorSummary({
    model,
    system: buildReportSystemPrompt("general_practice", detailLevel),
    prompt: `Generate a clinician-ready educational summary:\n${JSON.stringify(reportContext, null, 2)}${
      body.options?.include_citations ? "\nInclude explicit source filenames and dates in findings." : ""
    }`,
  });

  return NextResponse.json({
    tier: "pro",
    service: "clinician-summary",
    result: withDisclaimer(summary),
    usage: {
      biomarkers: context.biomarkers.length,
      documents: context.source_document_ids.length,
    },
    payment_receipt: paymentMeta(payment),
  });
}

export async function handleTrendAnalysis(body: AgentInsightRequest, payment: SettledPayment) {
  const context = mapAgentDataToContext(body.data);
  const byKey = new Map<string, typeof context.biomarkers>();
  for (const b of context.biomarkers) {
    const list = byKey.get(b.key) ?? [];
    list.push(b);
    byKey.set(b.key, list);
  }

  const trends = [...byKey.entries()].map(([key, rows]) => {
    const sorted = [...rows].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const delta = sorted.length > 1 ? last.value - first.value : 0;
    const outOfRange =
      (last.ref_low != null && last.value < last.ref_low) ||
      (last.ref_high != null && last.value > last.ref_high);

    return {
      key,
      biomarker: last.biomarker,
      points: sorted.length,
      first_value: first.value,
      last_value: last.value,
      delta,
      unit: last.unit,
      out_of_range: outOfRange,
      observed_range: { from: first.observed_at, to: last.observed_at },
    };
  });

  const model = resolveAgentModel();
  const narrative = await generateDoctorSummary({
    model,
    system: SAFETY_PROMPT,
    prompt: `Summarize these longitudinal biomarker trends educationally:\n${JSON.stringify(trends, null, 2)}`,
  });

  return NextResponse.json({
    tier: "plus",
    service: "trend-analysis",
    result: {
      trends,
      narrative: withDisclaimer(narrative),
    },
    usage: { biomarkers: context.biomarkers.length, series: trends.length },
    payment_receipt: paymentMeta(payment),
  });
}

export async function handleHolisticSynthesis(body: AgentInsightRequest, payment: SettledPayment) {
  const context = mapAgentDataToContext(body.data);
  const model = resolveAgentModel();
  const synthesis = await generateHolisticSynthesisText(model, context);

  return NextResponse.json({
    tier: "plus",
    service: "holistic-synthesis",
    result: {
      synthesis,
      disclaimer: "This is not medical advice. Consult a healthcare professional.",
    },
    usage: {
      biomarkers: context.biomarkers.length,
      findings: context.instrumental_findings.length,
      notes: context.consultation_notes.length,
    },
    payment_receipt: paymentMeta(payment),
  });
}
