import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReportBodySchema,
  isReportRange,
  isReportType,
  type ReportRange,
} from "@/lib/report-prompts";

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
    return NextResponse.json(
      { error: "Invalid range parameter" },
      { status: 400 },
    );
  }

  if (typeParam && !isReportType(typeParam)) {
    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  let query = supabase
    .from("reports")
    .select(
      "id, title, report_type, detail_level, summary_preview, abnormal_only, created_at",
    )
    .eq("profile_id", profileId)
    .is("invalidated_at", null)
    .order("created_at", { ascending: false });

  if (q) {
    const sanitized = sanitizeSearchTerm(q);
    if (sanitized) {
      query = query.or(
        `title.ilike.%${sanitized}%,summary_preview.ilike.%${sanitized}%`,
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
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      error:
        "Report generation is unavailable until the EH-150 validator handoff is present",
    },
    { status: 503 },
  );
}
