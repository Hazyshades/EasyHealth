import { NextRequest } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { noStoreJson } from "@/lib/documents/access";
import { isDuplicateDecision } from "@/lib/documents/duplicate-detection";

type RouteContext = { params: Promise<{ candidateId: string }> };

type ResolutionRow = {
  candidate_id: string;
  state: string;
  archived_document_id: string | null;
};

function resolutionErrorResponse(message: string) {
  if (message.includes("invalid_duplicate_decision")) {
    return noStoreJson({ error: "Invalid duplicate decision" }, { status: 400 });
  }
  if (message.includes("duplicate_candidate_not_found")) {
    return noStoreJson({ error: "Duplicate candidate not found" }, { status: 404 });
  }
  if (message.includes("duplicate_candidate_already_resolved")) {
    return noStoreJson(
      { error: "This duplicate candidate was already resolved" },
      { status: 409 },
    );
  }
  return noStoreJson(
    { error: "The duplicate decision could not be saved" },
    { status: 500 },
  );
}

export async function POST(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) return noStoreJson({ error: "Unauthorized" }, { status: 401 });

  const { candidateId } = await context.params;
  const body = await req.json().catch(() => null);
  if (!isDuplicateDecision(body?.decision)) {
    return noStoreJson({ error: "Invalid duplicate decision" }, { status: 400 });
  }

  const { data, error } = await createAdminClient().rpc(
    "eh130_resolve_duplicate_candidate",
    {
      p_candidate_id: candidateId,
      p_profile_id: profileId,
      p_decision: body.decision,
    },
  );

  if (error) {
    console.error("Failed to resolve duplicate document candidate", {
      candidateId,
      profileId,
      message: error.message,
    });
    return resolutionErrorResponse(error.message);
  }

  const row = (Array.isArray(data) ? data[0] : data) as ResolutionRow | null;
  if (!row) {
    return noStoreJson(
      { error: "The duplicate decision returned no result" },
      { status: 500 },
    );
  }

  return noStoreJson({
    candidate_id: row.candidate_id,
    state: row.state,
    archived_document_id: row.archived_document_id ?? null,
  });
}
