import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { getWritableSessionIdentity } from "@/lib/auth/identity";
import { getProfileById } from "@/lib/auth/profile";
import { GuestQuotaError, reserveGuestResource } from "@/lib/guest-quotas";
import { isGuestProductAccessAllowed } from "@/lib/guest-mode";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createReportBodySchema,
  isReportRange,
  isReportType,
  type ReportRange,
} from "@/lib/report-prompts";
import {
  createValidatedReport,
  ReportGenerationError,
} from "@/lib/report-generation";

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
  const identity = await getWritableSessionIdentity();
  const profileId = identity?.profileId ?? null;
  if (!identity || !profileId) {
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
  if (identity.isGuest) {
    try {
      await reserveGuestResource(profileId, "processing_count", 1);
    } catch (error) {
      if (error instanceof GuestQuotaError) {
        return NextResponse.json(
          {
            error:
              error.kind === "limit"
                ? "Guest processing quota exceeded"
                : "Guest processing quota unavailable",
          },
          { status: error.kind === "limit" ? 429 : 503 },
        );
      }
      return NextResponse.json(
        { error: "Guest processing quota unavailable" },
        { status: 503 },
      );
    }
  }

  if (identity.isGuest) {
    const currentProfile = await getProfileById(profileId);
    if (!isGuestProductAccessAllowed(currentProfile)) {
      return NextResponse.json(
        { error: "Guest session is no longer active" },
        { status: 409 },
      );
    }
  }

  try {
    const report = await createValidatedReport(profileId, parsed.data);
    return NextResponse.json({ id: report.id }, { status: 201 });
  } catch (error) {
    if (error instanceof ReportGenerationError) {
      return NextResponse.json(
        { error: error.code },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { error: "Report generation unavailable" },
      { status: 500 },
    );
  }
}
