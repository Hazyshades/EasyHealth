import { NextResponse } from "next/server";
import { getMeasurementRelationshipGraph } from "@/lib/knowledge/measurement-relationship-graph";

type RouteContext = { params: Promise<{ key: string }> };

const GRAPH_CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export const revalidate = 3600;

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  const graph = getMeasurementRelationshipGraph(key);
  if (!graph) {
    return NextResponse.json(
      { error: "Relationship graph not found" },
      { status: 404, headers: GRAPH_CACHE_HEADERS },
    );
  }

  return NextResponse.json(graph, { headers: GRAPH_CACHE_HEADERS });
}
