import { z } from "zod";
import { buildHealthNavigationPath } from "@/lib/health-navigation";

const measurementObservationSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    measurement_definition_key: z.string().nullable(),
    value: z.union([z.number(), z.string(), z.null()]),
    value_kind: z.string().nullable().optional(),
    value_text: z.string().nullable().optional(),
    unit: z.string().nullable(),
    original_value: z.union([z.number(), z.string(), z.null()]).optional(),
    original_unit: z.string().nullable().optional(),
    converted: z.boolean().optional(),
    conversion_note: z.string().nullable().optional(),
    observed_at: z.string().min(1).nullable(),
    ordinal: z.number().nullable().optional(),
    source_page: z.number().nullable().optional(),
    document_id: z.string().nullable(),
    documents: z
      .object({
        id: z.string().min(1),
        original_filename: z.string(),
        lab_name: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const biomarkerResponseSchema = z
  .object({ observations: z.array(measurementObservationSchema) })
  .passthrough();

export type MeasurementObservation = z.infer<
  typeof measurementObservationSchema
>;

/** Parses the existing Biomarkers response once at the network boundary. */
export function parseMeasurementResultsResponse(
  data: unknown,
): readonly MeasurementObservation[] {
  const parsed = biomarkerResponseSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("We could not load your uploaded results.");
  return parsed.data.observations;
}

export function selectMeasurementObservations(
  observations: readonly MeasurementObservation[],
  measurementDefinitionKey: string,
): readonly MeasurementObservation[] {
  return observations.filter(
    (observation) =>
      observation.measurement_definition_key === measurementDefinitionKey,
  );
}

export function formatMeasurementObservationValue(
  observation: MeasurementObservation,
): string {
  if (observation.value_kind && observation.value_kind !== "numeric") {
    return observation.value_text?.trim() || "Not reported";
  }
  if (observation.value === null || observation.value === "") {
    return observation.value_text?.trim() || "Not reported";
  }
  return `${observation.value}${observation.unit ? ` ${observation.unit}` : ""}`;
}
export function formatPanelArticleObservationValue(
  observation: MeasurementObservation,
): string {
  if (observation.value_kind && observation.value_kind !== "numeric") {
    return formatMeasurementObservationValue(observation);
  }
  const value = observation.original_value ?? observation.value;
  if (value === null || value === "") {
    return observation.value_text?.trim() || "Not reported";
  }
  const unit = observation.original_unit ?? observation.unit;
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function buildMeasurementBiomarkersHref(
  measurementDefinitionKey: string,
): string {
  return buildHealthNavigationPath("/app/biomarkers", {
    measurement: measurementDefinitionKey,
  });
}

export function buildMeasurementObservationSourceHref(
  observation: Pick<
    MeasurementObservation,
    "id" | "document_id" | "measurement_definition_key"
  >,
  returnTo: string,
): string | null {
  if (!observation.document_id || !observation.measurement_definition_key)
    return null;
  return buildHealthNavigationPath(
    `/app/documents/${observation.document_id}`,
    {
      measurement: observation.measurement_definition_key,
      observation: observation.id,
      returnTo,
    },
  );
}
