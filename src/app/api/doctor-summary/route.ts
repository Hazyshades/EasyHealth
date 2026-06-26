import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { withGateway } from "@/lib/x402";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { doctorSummarySchema, MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

const SAFETY_PROMPT = `You are an educational health literacy assistant for EasyHealth.
Generate a clinician-ready SUMMARY for discussion with a healthcare professional.
Rules:
- Educational language only. NO diagnoses, prescriptions, or treatment plans.
- Cite specific biomarker values and dates from the provided data.
- Include when_to_seek_care for urgent symptoms only (general guidance).
- Always set disclaimer to exactly: "This is not medical advice. Consult a healthcare professional."`;

async function handler(_req: NextRequest, _payment: import("@/lib/x402").SettledPayment) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: observations, error } = await supabase
    .from("observations")
    .select("*, documents(original_filename, observed_at)")
    .eq("profile_id", profileId)
    .order("observed_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!observations?.length) {
    return NextResponse.json(
      { error: "Upload lab results before requesting a summary" },
      { status: 400 }
    );
  }

  const context = observations.map((o) => ({
    biomarker: o.name,
    key: o.biomarker_key,
    value: o.value,
    unit: o.unit,
    ref_low: o.ref_low,
    ref_high: o.ref_high,
    observed_at: o.observed_at,
    source: o.documents?.original_filename ?? "unknown",
  }));

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: doctorSummarySchema,
    system: SAFETY_PROMPT,
    prompt: `Create a doctor visit summary from this patient's biomarker history:\n${JSON.stringify(context, null, 2)}`,
  });

  return NextResponse.json({
    ...object,
    disclaimer: MEDICAL_DISCLAIMER,
    paid: true,
  });
}

export const POST = withGateway(handler, "$0.05", "/api/doctor-summary", {
  getProfileId: getSessionProfileId,
});

export const maxDuration = 60;
