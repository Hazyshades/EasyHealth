import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProfileById } from "@/lib/auth/profile";
import { modelIdForStage, resolveModelForProfileStage } from "@/lib/ai-provider";
import { generateDoctorSummary } from "@/lib/generate-doctor-summary";
import {
  buildReportSystemPrompt,
  createReportBodySchema,
  isReportRange,
  isReportType,
  type ReportRange,
} from "@/lib/report-prompts";
import {
  buildMultiSourceReportContext,
  buildSummaryPreview,
  getEligibleDocumentIds,
  hasReportContextContent,
  withDisclaimer,
} from "@/lib/reports";
import { buildDocumentStructuredContext } from "@/lib/documents/structured-context";
import { getMeasurementDefinition } from "@/lib/biomarkers";

type LinkedRevision = {
  resolver_result: string | null;
  verification_status: string | null;
  measurement_definition_key: string | null;
  is_active: boolean;
};

function activeRevision(
  relation: LinkedRevision | LinkedRevision[] | null | undefined
): LinkedRevision | null {
  const revisions = Array.isArray(relation)
    ? relation
    : relation
      ? [relation]
      : [];
  return revisions.find((revision) => revision.is_active) ?? null;
}

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

export async function POST(req: NextRequest) {
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
      { error: "Upload and process documents before creating a report" },
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
  const structured = await buildDocumentStructuredContext(profileId, scopeIds);

  const { data: observations, error: obsError } = await supabase
    .from("observations")
    .select(
      "name, analyte_key, measurement_definition_key, resolution_status, value, unit, ref_low, ref_high, observed_at, value_kind, value_text, observation_kind, documents(original_filename, observed_at), normalization_revision:observation_normalization_revisions!observations_normalization_revision_fk(resolver_result, verification_status, measurement_definition_key, is_active)"
    )
    .eq("profile_id", profileId)
    .in("document_id", scopeIds)
    .eq("observation_kind", "lab")
    .order("observed_at", { ascending: true });

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  const context = buildMultiSourceReportContext(
    structured,
    (observations ?? []).map((o) => {
      const revision = activeRevision(
        o.normalization_revision as LinkedRevision | LinkedRevision[] | null
      );
      const measurementDefinitionKey =
        revision?.measurement_definition_key ?? o.measurement_definition_key ?? null;
      const resolutionStatus =
        revision?.resolver_result ?? o.resolution_status ?? null;
      const definition = measurementDefinitionKey
        ? getMeasurementDefinition(measurementDefinitionKey)
        : undefined;
      const registryBindingReady =
        revision?.is_active === true &&
        resolutionStatus === "resolved" &&
        definition?.maturity === "reviewed";
      const numericValue = o.value != null ? Number(o.value) : null;
      const document = Array.isArray(o.documents)
        ? o.documents[0] ?? null
        : o.documents ?? null;

      return {
        name: o.name,
        analyte_key: o.analyte_key ?? null,
        measurement_definition_key: measurementDefinitionKey,
        resolution_status: resolutionStatus,
        verification_status: revision?.verification_status ?? null,
        registry_binding_ready: registryBindingReady,
        value_kind: o.value_kind ?? "numeric",
        value_text:
          o.value_text ??
          (numericValue != null && Number.isFinite(numericValue)
            ? String(numericValue)
            : null),
        value:
          numericValue != null && Number.isFinite(numericValue)
            ? numericValue
            : null,
        unit: o.unit,
        ref_low: o.ref_low != null ? Number(o.ref_low) : null,
        ref_high: o.ref_high != null ? Number(o.ref_high) : null,
        observed_at: o.observed_at,
        documents: document as { original_filename: string; observed_at: string | null } | null,
      };
    }),
    abnormal_only
  );

  if (!hasReportContextContent(context)) {
    return NextResponse.json(
      { error: "No structured data found for the selected documents" },
      { status: 400 }
    );
  }

  let object;
  try {
    const profile = await getProfileById(profileId);
    const model = await resolveModelForProfileStage(profileId, "report");
    object = await generateDoctorSummary({
      model,
      system: buildReportSystemPrompt(report_type, detail_level),
      prompt: `Create a health report from this patient's records (labs, imaging, consultations):\n${JSON.stringify(context, null, 2)}`,
      trace: {
        provider: profile.ai_provider,
        profileId,
        documentId: null,
        stage: "report",
        modelId: modelIdForStage(profile.ai_provider, "report"),
        supabase,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[reports] generateDoctorSummary failed:", message);
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

  return NextResponse.json({ ...report });
}

export const maxDuration = 60;
