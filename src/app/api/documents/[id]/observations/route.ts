import { NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertDocumentOwner } from "@/lib/documents/access";

type RouteContext = { params: Promise<{ id: string }> };

type LinkedRevision = {
  resolver_result: string;
  verification_status: string;
  is_active: boolean;
};

type ObservationWithRevision = {
  id: string;
  analyte_key: string | null;
  measurement_definition_key: string | null;
  resolution_status: string | null;
  name: string;
  value: number | string | null;
  unit: string;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string;
  source_extracted_biomarker_id: string | null;
  normalization_revision: LinkedRevision | LinkedRevision[] | null;
};

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const { data: observations, error: obsError } = await supabase
    .from("observations")
    .select(
      "id, analyte_key, measurement_definition_key, resolution_status, name, value, unit, ref_low, ref_high, observed_at, source_extracted_biomarker_id, normalization_revision:observation_normalization_revisions!observations_normalization_revision_fk(resolver_result, verification_status, is_active)"
    )
    .eq("profile_id", profileId)
    .eq("document_id", id)
    .order("name", { ascending: true });

  if (obsError) {
    return NextResponse.json({ error: obsError.message }, { status: 500 });
  }

  const projectedObservations = ((observations ?? []) as ObservationWithRevision[]).map(
    ({ normalization_revision, ...observation }) => {
      const revisions = Array.isArray(normalization_revision)
        ? normalization_revision
        : normalization_revision
          ? [normalization_revision]
          : [];
      const activeRevision = revisions.find((revision) => revision.is_active) ?? null;
      return {
        ...observation,
        resolver_result: activeRevision?.resolver_result ?? null,
        verification_status: activeRevision?.verification_status ?? null,
      };
    }
  );

  return NextResponse.json({ observations: projectedObservations });
}
