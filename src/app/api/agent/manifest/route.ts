import { NextRequest, NextResponse } from "next/server";
import { buildAgentManifest } from "@/lib/agent-services";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const baseUrl = env.URL || req.nextUrl.origin;
  return NextResponse.json(buildAgentManifest(baseUrl));
}
