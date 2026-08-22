import {
  getMeasurementDefinition,
  listPanelDefinitions,
  type MeasurementDefinitionKey,
  type PanelDefinition,
  type PanelMember,
} from "@/lib/biomarkers";

export type TimelineLaboratoryObservation = Readonly<{
  id: string;
  document_id: string | null;
  measurement_definition_key: MeasurementDefinitionKey | null;
  name: string;
  value: number | string | null;
  value_kind?: string | null;
  value_text?: string | null;
  unit: string | null;
  ref_low: number | string | null;
  ref_high: number | string | null;
  observed_at: string | null;
  ordinal?: number | null;
  source_page: number | null;
  source_text?: string | null;
  specimen?: string | null;
  modifier?: string | null;
}>;

export type PanelMemberObservationGroup = Readonly<{
  member: PanelMember;
  definitionDisplayName: string;
  roleLabel: "Required" | "Optional";
  observations: readonly TimelineLaboratoryObservation[];
  missing: boolean;
}>;

export type LaboratoryPanelGroup = Readonly<{
  panel: PanelDefinition;
  members: readonly PanelMemberObservationGroup[];
  reportedMemberCount: number;
  missingMemberCount: number;
}>;

export type GroupedLaboratoryObservations = Readonly<{
  panels: readonly LaboratoryPanelGroup[];
  ungrouped: readonly TimelineLaboratoryObservation[];
}>;

function compareNullableText(left: string | null | undefined, right: string | null | undefined): number {
  const a = left ?? "";
  const b = right ?? "";
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareNullableNumber(left: number | null | undefined, right: number | null | undefined): number {
  const a = left ?? Number.POSITIVE_INFINITY;
  const b = right ?? Number.POSITIVE_INFINITY;
  return a - b;
}

function observationSort(left: TimelineLaboratoryObservation, right: TimelineLaboratoryObservation): number {
  const ordinalOrder = compareNullableNumber(left.ordinal, right.ordinal);
  if (ordinalOrder !== 0) return ordinalOrder;
  const dateOrder = compareNullableText(left.observed_at, right.observed_at);
  if (dateOrder !== 0) return dateOrder;
  const sourcePageOrder = compareNullableNumber(left.source_page, right.source_page);
  if (sourcePageOrder !== 0) return sourcePageOrder;
  return compareNullableText(left.id, right.id);
}

function memberSort(left: PanelMember, right: PanelMember): number {
  const order = left.displayOrder - right.displayOrder;
  if (order !== 0) return order;
  return compareNullableText(left.measurementDefinitionKey, right.measurementDefinitionKey);
}


/**
 * Build the event-level panel projection without mutating the source rows.
 * Detection is deliberately key-based: aliases and document text are not
 * trustworthy enough to create a clinical grouping.
 */
export function groupLaboratoryObservations(
  observations: readonly TimelineLaboratoryObservation[],
  panels: readonly PanelDefinition[] = listPanelDefinitions(),
): GroupedLaboratoryObservations {
  const orderedObservations = [...observations].sort(observationSort);
  const owningPanels = new Map<string, PanelDefinition[]>();

  for (const panel of panels) {
    for (const member of panel.members) {
      const owners = owningPanels.get(member.measurementDefinitionKey) ?? [];
      owners.push(panel);
      owningPanels.set(member.measurementDefinitionKey, owners);
    }
  }

  const assignedObservationIds = new Set<string>();
  const panelGroups: LaboratoryPanelGroup[] = [];

  for (const panel of panels) {
    const observationsByMember = new Map<string, TimelineLaboratoryObservation[]>();
    let hasObservedMember = false;

    for (const observation of orderedObservations) {
      const key = observation.measurement_definition_key;
      if (!key || !owningPanels.get(key)?.includes(panel)) continue;
      const memberObservations = observationsByMember.get(key) ?? [];
      memberObservations.push(observation);
      observationsByMember.set(key, memberObservations);
      assignedObservationIds.add(observation.id);
      hasObservedMember = true;
    }

    if (!hasObservedMember) continue;

    const members = [...panel.members].sort(memberSort).map((member) => {
      const memberObservations = observationsByMember.get(member.measurementDefinitionKey) ?? [];
      return {
        member,
        definitionDisplayName:
          getMeasurementDefinition(member.measurementDefinitionKey)?.displayName ??
          member.measurementDefinitionKey,
        roleLabel: member.role === "required" ? "Required" : "Optional",
        observations: memberObservations,
        missing: memberObservations.length === 0,
      } satisfies PanelMemberObservationGroup;
    });

    panelGroups.push({
      panel,
      members,
      reportedMemberCount: members.filter((member) => !member.missing).length,
      missingMemberCount: members.filter((member) => member.missing).length,
    });
  }

  return {
    panels: panelGroups,
    ungrouped: orderedObservations.filter(
      (observation) => !assignedObservationIds.has(observation.id),
    ),
  };
}

/**
 * Preserve the existing document viewer deep-link contract without inventing
 * a source page when provenance is unavailable or invalid.
 */
export function buildObservationSourceHref(
  documentId: string | null | undefined,
  sourcePage: number | null | undefined,
): string | null {
  if (!documentId) return null;
  const href = `/app/documents/${encodeURIComponent(documentId)}`;
  const validSourcePage =
    typeof sourcePage === "number" && Number.isInteger(sourcePage) && sourcePage > 0
      ? sourcePage
      : null;
  return validSourcePage === null ? href : `${href}?page=${validSourcePage}`;
}
