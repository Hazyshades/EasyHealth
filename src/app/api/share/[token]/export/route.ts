import type { NextRequest } from "next/server";
import {
  handlePublicShareExport,
  type PublicExportRouteContext,
} from "@/lib/share-links/public-export-route";

export async function GET(
  request: NextRequest,
  context: PublicExportRouteContext,
) {
  return handlePublicShareExport(request, context);
}
