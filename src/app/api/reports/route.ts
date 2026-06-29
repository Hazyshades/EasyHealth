import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { withGateway } from "@/lib/x402";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveModelForProfile } from "@/lib/ai-provider";
import { doctorSummaryGenerationSchema } from "@/lib/schemas/biomarkers";
import {
  buildReportSystemPrompt,
  createReportBodySchema,
  isReportRange,
  isReportType,
  type ReportRange,
} from "@/lib/report-prompts";
import {
  buildReportContext,
  buildSummaryPreview,
  filterAbnormalObservations,
  getEligibleDocumentIds,
  withDisclaimer,
} from "@/lib/reports";

function sanitizeSearchTerm(value: string): string {
  return value.replace(/[%_,]/g, "").trim();
}

function rangeStartDate(range: ReportRange): string | null {
  const now = new Date();
  if (range === "all") return null;
  if (range === "30d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }
  if (range === "90d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 90);
    return d.toISOString();
  }
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return startOfYear.toISOString();
}

export async function GET(req: NextRequest) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const rangeParam = req.nextUrl.searchParams.get("range") ?? "all";
  const typeParam = req.nextUrl.searchParams.get("type");

  if (!isReportRange(rangeParam)) {
    return NextResponse.json({ error: "Invalid range parameter" }, { status: 400 });
  }

  if (typeParam && !isReportType(typeParam)) {
    return NextResponse.json({ error: "Invalid type parameter" }, { status: 400 });
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("reports")
    .select(
      "id, title, report_type, detail_level, summary_preview, abnormal_only, created_at"
    )
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (q) {
    const sanitized = sanitizeSearchTerm(q);
    if (sanitized) {
      query = query.or(
        `title.ilike.%${sanitized}%,summary_preview.ilike.%${sanitized}%`
      );
    }
  }

  const rangeStart = rangeStartDate(rangeParam);
  if (rangeStart) {
    query = query.gte("created_at", rangeStart);
  }

  if (typeParam) {
    query = query.eq("report_type", typeParam);
  }

  const { data: reports, error } = await query;

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

  const { title, report_type, detail_level, document_ids, abnormal_only } = parsed.data;
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

  const scopedObservations = abnormal_only
    ? filterAbnormalObservations(observations)
    : observations;

  if (abnormal_only && scopedObservations.length === 0) {
    return NextResponse.json(
      { error: "No out-of-range indicators found for the selected documents" },
      { status: 400 }
    );
  }

  const context = buildReportContext(scopedObservations);

  let object;
  try {
    const model = await resolveModelForProfile(profileId);
    const result = await generateObject({
      model,
      schema: doctorSummaryGenerationSchema,
      maxRetries: 2,
      system: buildReportSystemPrompt(report_type, detail_level),
      prompt: `Create a health report from this patient's biomarker history:\n${JSON.stringify(context, null, 2)}`,
    });
    object = result.object;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[reports] generateObject failed:", message);
    return NextResponse.json(
      { error: "Report generation failed", message },
      { status: 500 }
    );
  }

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
      abnormal_only,
      content,
      summary_preview,
    })
    .select(
      "id, title, report_type, detail_level, document_ids, abnormal_only, content, summary_preview, created_at"
    )
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: "Report generation failed", message: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ...report, paid: true });
}

export const POST = withGateway(postHandler, "$0.05", "/api/reports", {
  getProfileId: getSessionProfileId,
});

export const maxDuration = 60;
