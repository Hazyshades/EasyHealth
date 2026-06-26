import { NextRequest, NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { withGateway } from "@/lib/x402";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { doctorSummarySchema } from "@/lib/schemas/biomarkers";
import { createReportBodySchema, buildReportSystemPrompt } from "@/lib/report-prompts";
import {
  buildReportContext,
  buildSummaryPreview,
  getEligibleDocumentIds,
  withDisclaimer,
} from "@/lib/reports";

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: reports, error } = await supabase
    .from("reports")
    .select(
      "id, title, report_type, detail_level, summary_preview, created_at"
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ reports: reports ?? [] });
}

async function postHandler(req: NextRequest, _payment: import("@/lib/x402").SettledPayment) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createReportBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { title, report_type, detail_level, document_ids } = parsed.data;
  const eligibleIds = await getEligibleDocumentIds(profileId);

  if (eligibleIds.length === 0) {
    return NextResponse.json(
      { error: "Upload and process lab results before creating a report" },
      { status: 400 }
    );
  }

  let scopeIds: string[];
  let storedDocumentIds: string[] | null;

  if (document_ids == null) {
    scopeIds = eligibleIds;
    storedDocumentIds = null;
  } else if (document_ids.length === 0) {
    return NextResponse.json(
      { error: "Select at least one document for the report" },
      { status: 400 }
    );
  } else {
    const invalid = document_ids.filter((id) => !eligibleIds.includes(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "One or more selected documents are not eligible for reports" },
        { status: 400 }
      );
    }
    scopeIds = document_ids;
    storedDocumentIds = document_ids;
  }

  const supabase = createAdminClient();
  const { data: observations, error: obsError } = await supabase
    .from("observations")
    .select("*, documents(original_filename, observed_at)")
    .eq("profile_id", profileId)
    .in("document_id", scopeIds)
    .order("observed_at", { ascending: true });

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  if (!observations?.length) {
    return NextResponse.json(
      { error: "No biomarker data found for the selected documents" },
      { status: 400 }
    );
  }

  const context = buildReportContext(observations);

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: doctorSummarySchema,
    system: buildReportSystemPrompt(report_type, detail_level),
    prompt: `Create a health report from this patient's biomarker history:\n${JSON.stringify(context, null, 2)}`,
  });

  const content = withDisclaimer(object);
  const summary_preview = buildSummaryPreview(content.overview);

  const { data: report, error: insertError } = await supabase
    .from("reports")
    .insert({
      profile_id: profileId,
      title,
      report_type,
      detail_level,
      document_ids: storedDocumentIds,
      content,
      summary_preview,
    })
    .select(
      "id, title, report_type, detail_level, document_ids, content, summary_preview, created_at"
    )
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ...report, paid: true });
}

export const POST = withGateway(postHandler, "$0.05", "/api/reports", {
  getProfileId: getSessionProfileId,
});

export const maxDuration = 60;
