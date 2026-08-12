import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { assertDocumentOwner, noStoreJson } from "@/lib/documents/access";
import {
  OBSERVATION_CHANGE_HISTORY_DEFAULT_LIMIT,
  OBSERVATION_CHANGE_HISTORY_MAX_LIMIT,
  readObservationChangeEvents,
} from "@/lib/documents/observation-change-events";
import { buildObservationChangeEntries } from "@/lib/documents/observation-change-history";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * EH-121: the document's append-only change history, newest first.
 *
 * Optional `observationId` and `extractedBiomarkerId` narrow the result to one
 * review row. `limit` is explicit rather than a cursor because a document's
 * history is bounded by its row count; an out-of-range limit is rejected rather
 * than silently clamped, so a caller never believes it received everything.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const rawLimit = req.nextUrl.searchParams.get("limit");
  let limit = OBSERVATION_CHANGE_HISTORY_DEFAULT_LIMIT;
  if (rawLimit !== null) {
    limit = Number(rawLimit);
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > OBSERVATION_CHANGE_HISTORY_MAX_LIMIT
    ) {
      return NextResponse.json(
        {
          error: `limit must be an integer between 1 and ${OBSERVATION_CHANGE_HISTORY_MAX_LIMIT}`,
        },
        { status: 400 },
      );
    }
  }

  const result = await readObservationChangeEvents({
    profileId,
    documentId: id,
    observationId: req.nextUrl.searchParams.get("observationId"),
    extractedBiomarkerId: req.nextUrl.searchParams.get("extractedBiomarkerId"),
    limit,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return noStoreJson({
    entries: buildObservationChangeEntries(result.rows, {
      viewerProfileId: profileId,
    }),
  });
}
