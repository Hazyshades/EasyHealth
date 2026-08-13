import { NextResponse } from "next/server";
import { resolveMeasurementDefinition } from "@/lib/biomarkers";
import { getSessionProfileId } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  baseMeasurementFromExtractedRow,
  parseMeasurementOverride,
  validateMeasurementCorrection,
  type MeasurementOverride,
} from "@/lib/documents/observation-measurement-correction";
import { assertDocumentOwner } from "@/lib/documents/access";
import {
  compatibleManualDefinitions,
  getActiveNormalizationRevision,
} from "@/lib/documents/normalization-revisions";
import {
  buildManualCorrectionResolution,
  measurementInputFromWriterRow,
  ObservationNormalizationWriterError,
  type ExtractedBiomarkerWriterRow,
  writeExtractedBiomarkerNormalization,
} from "@/lib/documents/observation-normalization-writer";
import {
  buildNormalizationReview,
  type NormalizationRevisionSummary,
} from "@/lib/documents/normalization-review";
import { failureMessage } from "@/lib/documents/biomarker-acceptance-batch";

type RouteContext = { params: Promise<{ id: string }> };

type ExtractedBiomarkerRow = ExtractedBiomarkerWriterRow;

export async function GET(_req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await assertDocumentOwner(profileId, id);
  if (error) return error;

  const supabase = createAdminClient();
  const { data: items, error: listError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, source_page, source_text, confidence, status, processing_version, extraction_model, specimen, modifier, method, reported_alt_value, reported_alt_unit, raw_value_text, measurement_definition_key, resolver_result, mapping_confidence, mapping_confidence_band, resolver_evidence, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, verification_status, created_at"
    )
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .order("biomarker_name", { ascending: true });

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const rows = (items ?? []) as unknown as ExtractedBiomarkerRow[];
  const ids = rows.map((item) => item.id);
  const revisionsResult = ids.length
    ? await supabase
        .from("observation_normalization_revisions")
        .select(
          "id, extracted_biomarker_id, analyte_key, measurement_definition_key, resolver_result, mapping_confidence, mapping_confidence_band, verification_status, is_active, resolver_evidence, catalog_manifest_version, catalog_manifest_digest, resolver_version, normalization_version, resolver_decision_trace, resolver_trace_schema_version, measurement_override, created_at"
        )
        .in("extracted_biomarker_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>> };
  const revisionsByExtractedId = new Map<string, Array<Record<string, unknown>>>();
  for (const revision of revisionsResult.data ?? []) {
    const key = String(revision.extracted_biomarker_id);
    const entries = revisionsByExtractedId.get(key) ?? [];
    entries.push(revision as Record<string, unknown>);
    revisionsByExtractedId.set(key, entries);
  }
  return NextResponse.json({
    items: rows.map((row) => ({
      ...row,
      normalization: buildNormalizationReview(
        row,
        (revisionsByExtractedId.get(row.id) ?? []) as unknown as NormalizationRevisionSummary[]
      ),
    })),
  });
}

export async function PATCH(req: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const { doc, error: ownerError } = await assertDocumentOwner(profileId, id);
  if (ownerError) return ownerError;

  const body = (await req.json().catch(() => null)) as
    | {
        extractedBiomarkerId?: string;
        action?: "correct" | "edit-value" | "undo";
        measurementDefinitionKey?: string;
        correctionReason?: string;
        revertToRevisionId?: string;
        measurementOverride?: unknown;
        acknowledgeDefinitionLoss?: boolean;
        expectedActiveRevisionId?: string | null;
        value?: unknown;
        value_text?: unknown;
        value_kind?: unknown;
        ordinal?: unknown;
        unit?: unknown;
        ref_low?: unknown;
        ref_high?: unknown;
        observed_at?: unknown;
      }
    | null;
  if (
    !body?.extractedBiomarkerId ||
    (body.action !== "correct" &&
      body.action !== "edit-value" &&
      body.action !== "undo")
  ) {
    return NextResponse.json(
      { error: "Invalid normalization review request" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error: extractedError } = await supabase
    .from("document_extracted_biomarkers")
    .select(
      "id, biomarker_key, biomarker_name, raw_name, value_numeric, value_text, value_kind, ordinal, unit, raw_unit, reference_range, raw_reference_range, section_context, confidence, specimen, modifier, method, source_page, source_text, bounding_box, reported_alt_value, reported_alt_unit, raw_value_text, processing_version",
    )
    .eq("id", body.extractedBiomarkerId)
    .eq("document_id", id)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .maybeSingle();
  if (extractedError) {
    return NextResponse.json({ error: extractedError.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "Extracted biomarker not found" },
      { status: 404 },
    );
  }
  const row = data as ExtractedBiomarkerRow;

  try {
    const activeRevision = await getActiveNormalizationRevision(row.id);
    if (
      body.expectedActiveRevisionId !== undefined &&
      body.expectedActiveRevisionId !== (activeRevision?.id ?? null)
    ) {
      return NextResponse.json(
        {
          error: "This result changed while you were editing it. Reload the row and try again.",
          code: "stale_revision_conflict",
        },
        { status: 409 },
      );
    }
    if (body.action === "undo" && (!body.revertToRevisionId || !activeRevision)) {
      return NextResponse.json(
        { error: "An active revision and a revision to restore are required" },
        { status: 400 },
      );
    }
    if (
      body.action !== "undo" &&
      (typeof body.correctionReason !== "string" ||
        body.correctionReason.trim().length === 0)
    ) {
      return NextResponse.json(
        {
          error: "Say why you are correcting this result.",
          code: "correction_reason_required",
          field: "correction_reason",
        },
        { status: 400 },
      );
    }

    if (body.action === "edit-value") {
      const directFields = [
        "value",
        "value_text",
        "value_kind",
        "ordinal",
        "unit",
        "ref_low",
        "ref_high",
        "observed_at",
      ] as const;
      const directOverride = Object.fromEntries(
        directFields
          .filter((field) => field in body)
          .map((field) => [field, body[field]]),
      );
      const requestedOverride = body.measurementOverride ?? directOverride;
      const parsedOverride = parseMeasurementOverride(requestedOverride);
      if (!parsedOverride.ok) {
        return NextResponse.json(
          {
            error: parsedOverride.message,
            code: parsedOverride.code,
            field: parsedOverride.field,
            observed: parsedOverride.observed,
            expected: parsedOverride.expected,
          },
          { status: 400 },
        );
      }

      // Overrides are absolute against extraction. A subsequent edit may name
      // only the field changed in the form, so carry forward the active
      // restatement before validating and persisting the new revision.
      const effectiveOverride =
        body.measurementOverride !== undefined
          ? parsedOverride.override
          : {
              ...(activeRevision?.measurement_override ?? {}),
              ...parsedOverride.override,
            };
      const validation = validateMeasurementCorrection({
        base: baseMeasurementFromExtractedRow(
          row,
          doc!.observed_at ?? new Date().toISOString().slice(0, 10),
        ),
        override: effectiveOverride,
        correctionReason: body.correctionReason,
        boundDefinitionKey: activeRevision?.measurement_definition_key,
        acknowledgeDefinitionLoss: body.acknowledgeDefinitionLoss === true,
      });
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: validation.message,
            code: validation.code,
            field: validation.field,
            observed: validation.observed,
            expected: validation.expected,
          },
          { status: 400 },
        );
      }

      const input = measurementInputFromWriterRow(row, validation.override);
      const resolution = resolveMeasurementDefinition(input);
      const writerResult = await writeExtractedBiomarkerNormalization({
        profileId,
        documentId: id,
        observedAt: doc!.observed_at ?? new Date().toISOString().slice(0, 10),
        row,
        actorId: profileId,
        writeKind: "value_correction",
        resolution,
        expectedActiveRevision: activeRevision,
        measurementOverride: validation.override,
        mappingClassification: validation.losesDefinitionBinding
          ? "review_required"
          : "additive",
        correctionReason: body.correctionReason,
        supersedesRevisionId: activeRevision?.id ?? null,
      });
      return NextResponse.json({
        revision: writerResult,
        compatibleDefinitionKeys: compatibleManualDefinitions(input).map(
          (definition) => definition.key,
        ),
        userCorrected: true,
      });
    }

    if (body.action === "undo") {
      if (!activeRevision) {
        return NextResponse.json(
          { error: "An active revision is required to undo a correction" },
          { status: 400 },
        );
      }
      const { data: targetRevision, error: targetError } = await supabase
        .from("observation_normalization_revisions")
        .select("id, measurement_definition_key, measurement_override")
        .eq("id", body.revertToRevisionId!)
        .eq("extracted_biomarker_id", row.id)
        .maybeSingle();
      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 });
      }
      if (!targetRevision) {
        return NextResponse.json(
          { error: "The selected revision was not found for this result" },
          { status: 404 },
        );
      }

      const targetOverride = (targetRevision.measurement_override ?? null) as
        | MeasurementOverride
        | null;
      const input = measurementInputFromWriterRow(row, targetOverride);
      const targetDefinitionKey =
        typeof targetRevision.measurement_definition_key === "string"
          ? targetRevision.measurement_definition_key
          : null;
      const resolution = targetDefinitionKey
        ? buildManualCorrectionResolution({
            input,
            selectedDefinitionKey: targetDefinitionKey,
          })
        : resolveMeasurementDefinition(input);
      const writerResult = await writeExtractedBiomarkerNormalization({
        profileId,
        documentId: id,
        observedAt: doc!.observed_at ?? new Date().toISOString().slice(0, 10),
        row,
        actorId: profileId,
        writeKind: "value_correction",
        resolution,
        expectedActiveRevision: activeRevision,
        measurementOverride: targetOverride,
        correctionReason:
          typeof body.correctionReason === "string" &&
          body.correctionReason.trim()
            ? body.correctionReason
            : "Manual correction reverted",
        reversalOfRevisionId: targetRevision.id,
        supersedesRevisionId: activeRevision.id,
      });
      return NextResponse.json({
        revision: writerResult,
        compatibleDefinitionKeys: compatibleManualDefinitions(input).map(
          (definition) => definition.key,
        ),
        userCorrected: targetOverride !== null,
      });
    }

    if (!body.measurementDefinitionKey) {
      return NextResponse.json(
        { error: "A compatible definition is required" },
        { status: 400 },
      );
    }
    if (!body.correctionReason?.trim()) {
      return NextResponse.json(
        {
          error: "Say why you are selecting a different measurement definition.",
          code: "correction_reason_required",
          field: "correction_reason",
        },
        { status: 400 },
      );
    }

    const input = measurementInputFromWriterRow(
      row,
      activeRevision?.measurement_override,
    );
    const resolution = buildManualCorrectionResolution({
      input,
      selectedDefinitionKey: body.measurementDefinitionKey,
    });
    const writerResult = await writeExtractedBiomarkerNormalization({
      profileId,
      documentId: id,
      observedAt: doc!.observed_at ?? new Date().toISOString().slice(0, 10),
      row,
      actorId: profileId,
      writeKind: "correction",
      resolution,
      expectedActiveRevision: activeRevision,
      measurementOverride: activeRevision?.measurement_override,
      correctionReason: body.correctionReason,
      supersedesRevisionId: activeRevision?.id ?? null,
    });
    return NextResponse.json({
      revision: writerResult,
      compatibleDefinitionKeys: compatibleManualDefinitions(input).map(
        (definition) => definition.key,
      ),
      userCorrected: activeRevision?.measurement_override != null,
    });
  } catch (error) {
    const message = failureMessage(error);
    if (error instanceof ObservationNormalizationWriterError) {
      return NextResponse.json(
        { error: message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
