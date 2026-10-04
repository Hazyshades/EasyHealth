import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import {
  createReportExportResponse,
  isExportFormat,
  ReportExportError,
  renderReportExport,
} from "@/lib/report-export";
import { classifyReportExportFailure } from "@/lib/report-export/route-response";

type RouteParams = { params: Promise<{ id: string }> };

function failureResponse(error: unknown): NextResponse {
  const failure = classifyReportExportFailure(error);
  return NextResponse.json(failure.body, { status: failure.status });
}

/**
 * Owner export endpoint.
 *
 * Authorization stays in the adapter: the route only resolves the session and
 * the requested format, then delegates to `renderReportExport`, which re-reads
 * the report through EH-148's resolver in `export` mode and cannot widen scope.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const requested = req.nextUrl.searchParams.get("format");
  if (!requested || !isExportFormat(requested)) {
    return failureResponse(
      new ReportExportError("FORMAT_NOT_ALLOWED", "Export is unavailable"),
    );
  }

  try {
    const file = await renderReportExport(
      { kind: "owner", profileId },
      requested,
      {
        reportId: id,
      },
    );
    return createReportExportResponse(file, { kind: "owner" });
  } catch (error) {
    return failureResponse(error);
  }
}
