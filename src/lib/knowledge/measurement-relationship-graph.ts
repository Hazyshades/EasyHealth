import { createHash } from "node:crypto";
import {
  MEASUREMENT_DEFINITIONS,
  PANEL_DEFINITIONS,
  PANEL_REGISTRY_VERSION,
  type MeasurementDefinition,
  type MeasurementDefinitionKey,
  type PanelDefinition,
  type PanelKey,
  type PanelMemberRole,
} from "@/lib/biomarkers";

export const RELATED_MEASUREMENT_GRAPH_VERSION = "2026-09-01.0" as const;

export type RelationshipNodeKind = "measurement" | "panel";
export type RelationshipType = "panel_member" | "related_measurement";
export type RelationshipAxis = "specimen" | "timing" | "property";

export const RELATIONSHIP_TYPE_LABELS = {
  panel_member: "Panel member",
  related_measurement: "Related measurement",
} as const satisfies Readonly<Record<RelationshipType, string>>;

export const RELATIONSHIP_AXIS_LABELS = {
  specimen: "Specimen variant",
  timing: "Timing variant",
  property: "Property variant",
} as const satisfies Readonly<Record<RelationshipAxis, string>>;

export type RelationshipNodeRef = Readonly<{
  kind: RelationshipNodeKind;
  key: string;
}>;

export type RelationshipNode = Readonly<
  RelationshipNodeRef & {
    displayName: string;
  }
>;

export type CuratedMeasurementRelationship = Readonly<{
  key: string;
  sourceMeasurementDefinitionKey: MeasurementDefinitionKey;
  targetMeasurementDefinitionKey: MeasurementDefinitionKey;
  axis: RelationshipAxis;
  description: string;
}>;

export type PanelMemberRelationshipEdge = Readonly<{
  key: string;
  version: typeof RELATED_MEASUREMENT_GRAPH_VERSION;
  relationshipType: "panel_member";
  source: RelationshipNodeRef;
  target: RelationshipNodeRef;
  label: "Panel member";
  description: string;
  role: PanelMemberRole;
  displayOrder: number;
}>;

export type RelatedMeasurementRelationshipEdge = Readonly<{
  key: string;
  version: typeof RELATED_MEASUREMENT_GRAPH_VERSION;
  relationshipType: "related_measurement";
  source: RelationshipNodeRef;
  target: RelationshipNodeRef;
  label: "Related measurement";
  axis: RelationshipAxis;
  axisLabel: string;
  description: string;
}>;

export type MeasurementRelationshipEdge =
  | PanelMemberRelationshipEdge
  | RelatedMeasurementRelationshipEdge;

export type MeasurementRelationshipGraph = Readonly<{
  version: typeof RELATED_MEASUREMENT_GRAPH_VERSION;
  root: RelationshipNode;
  nodes: readonly RelationshipNode[];
  edges: readonly MeasurementRelationshipEdge[];
}>;

export type MeasurementRelationshipGraphValidation = Readonly<{
  valid: boolean;
  errors: readonly string[];
}>;

/**
 * Explicitly curated same-analyte relationships. Panel membership is derived
 * from PANEL_DEFINITIONS below so the graph cannot drift from the panel roster.
 */
export const CURATED_MEASUREMENT_RELATIONSHIPS: readonly CuratedMeasurementRelationship[] =
  [
    {
      key: "glucose-plasma-fasting",
      sourceMeasurementDefinitionKey: "glucose_plasma",
      targetMeasurementDefinitionKey: "fasting_glucose",
      axis: "timing",
      description:
        "The same analyte is represented with a different timing axis in the reviewed catalog.",
    },
    {
      key: "glucose-plasma-post-prandial",
      sourceMeasurementDefinitionKey: "glucose_plasma",
      targetMeasurementDefinitionKey: "post_prandial_glucose_plasma",
      axis: "timing",
      description:
        "The same analyte is represented with a different timing axis in the reviewed catalog.",
    },
    {
      key: "glucose-fasting-post-prandial",
      sourceMeasurementDefinitionKey: "fasting_glucose",
      targetMeasurementDefinitionKey: "post_prandial_glucose_plasma",
      axis: "timing",
      description:
        "The same analyte is represented with a different timing axis in the reviewed catalog.",
    },
    {
      key: "glucose-serum-plasma",
      sourceMeasurementDefinitionKey: "glucose_serum",
      targetMeasurementDefinitionKey: "glucose_plasma",
      axis: "specimen",
      description:
        "The same analyte is represented with a different specimen axis in the reviewed catalog.",
    },
    {
      key: "glucose-serum-whole-blood",
      sourceMeasurementDefinitionKey: "glucose_serum",
      targetMeasurementDefinitionKey: "glucose_whole_blood",
      axis: "specimen",
      description:
        "The same analyte is represented with a different specimen axis in the reviewed catalog.",
    },
    {
      key: "alt-serum-plasma",
      sourceMeasurementDefinitionKey: "alt_serum_catalytic_activity",
      targetMeasurementDefinitionKey: "alt_plasma_catalytic_activity",
      axis: "specimen",
      description:
        "The same analyte is represented with a different specimen axis in the reviewed catalog.",
    },
    {
      key: "ast-serum-plasma",
      sourceMeasurementDefinitionKey: "ast_serum_catalytic_activity",
      targetMeasurementDefinitionKey: "ast_plasma_catalytic_activity",
      axis: "specimen",
      description:
        "The same analyte is represented with a different specimen axis in the reviewed catalog.",
    },
    {
      key: "alp-serum-plasma",
      sourceMeasurementDefinitionKey: "alp_serum_catalytic_activity",
      targetMeasurementDefinitionKey: "alp_plasma_catalytic_activity",
      axis: "specimen",
      description:
        "The same analyte is represented with a different specimen axis in the reviewed catalog.",
    },
    {
      key: "ggt-serum-plasma",
      sourceMeasurementDefinitionKey: "ggt_serum_catalytic_activity",
      targetMeasurementDefinitionKey: "ggt_plasma_catalytic_activity",
      axis: "specimen",
      description:
        "The same analyte is represented with a different specimen axis in the reviewed catalog.",
    },
    {
      key: "neutrophils-percent-absolute",
      sourceMeasurementDefinitionKey: "neutrophils_percent",
      targetMeasurementDefinitionKey: "neutrophils_abs",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
    {
      key: "lymphocytes-percent-absolute",
      sourceMeasurementDefinitionKey: "lymphocytes_percent",
      targetMeasurementDefinitionKey: "lymphocytes_abs",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
    {
      key: "monocytes-percent-absolute",
      sourceMeasurementDefinitionKey: "monocytes_percent",
      targetMeasurementDefinitionKey: "monocytes_abs",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
    {
      key: "eosinophils-percent-absolute",
      sourceMeasurementDefinitionKey: "eosinophils_percent",
      targetMeasurementDefinitionKey: "eosinophils_abs",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
    {
      key: "basophils-percent-absolute",
      sourceMeasurementDefinitionKey: "basophils_percent",
      targetMeasurementDefinitionKey: "basophils_abs",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
    {
      key: "reticulocytes-percent-absolute",
      sourceMeasurementDefinitionKey: "reticulocytes_percent",
      targetMeasurementDefinitionKey: "reticulocytes_abs",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
    {
      key: "rdw-cv-sd",
      sourceMeasurementDefinitionKey: "rdw_cv",
      targetMeasurementDefinitionKey: "rdw_sd",
      axis: "property",
      description:
        "The same analyte is represented with a different property axis in the reviewed catalog.",
    },
  ] as const;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isReviewedMeasurement(
  definition: MeasurementDefinition | undefined,
): definition is MeasurementDefinition & { maturity: "reviewed" } {
  return (
    definition?.maturity === "reviewed" &&
    definition.sourceProvenance.kind === "registry_v2_review"
  );
}

const MEASUREMENT_DEFINITIONS_BY_KEY = new Map(
  MEASUREMENT_DEFINITIONS.map((definition) => [definition.key, definition]),
);
function measurementNode(
  key: MeasurementDefinitionKey,
  definitionsByKey: ReadonlyMap<
    string,
    MeasurementDefinition
  > = MEASUREMENT_DEFINITIONS_BY_KEY,
): RelationshipNode {
  const definition = definitionsByKey.get(key);
  return {
    kind: "measurement",
    key,
    displayName: definition?.displayName ?? key,
  };
}

function panelNode(panel: PanelDefinition): RelationshipNode {
  return { kind: "panel", key: panel.key, displayName: panel.displayName };
}

function panelMemberEdge(
  panel: PanelDefinition,
  member: PanelDefinition["members"][number],
  definitionsByKey: ReadonlyMap<string, MeasurementDefinition>,
): PanelMemberRelationshipEdge {
  const definitionName = measurementNode(
    member.measurementDefinitionKey,
    definitionsByKey,
  ).displayName;
  return {
    key: `panel-member:${panel.key}:${member.measurementDefinitionKey}`,
    version: RELATED_MEASUREMENT_GRAPH_VERSION,
    relationshipType: "panel_member",
    source: { kind: "panel", key: panel.key },
    target: { kind: "measurement", key: member.measurementDefinitionKey },
    label: RELATIONSHIP_TYPE_LABELS.panel_member,
    description: `${definitionName} is listed in ${panel.displayName} as a ${member.role} catalog member.`,
    role: member.role,
    displayOrder: member.displayOrder,
  };
}

function relatedMeasurementEdge(
  relationship: CuratedMeasurementRelationship,
): RelatedMeasurementRelationshipEdge {
  return {
    key: relationship.key,
    version: RELATED_MEASUREMENT_GRAPH_VERSION,
    relationshipType: "related_measurement",
    source: {
      kind: "measurement",
      key: relationship.sourceMeasurementDefinitionKey,
    },
    target: {
      kind: "measurement",
      key: relationship.targetMeasurementDefinitionKey,
    },
    label: RELATIONSHIP_TYPE_LABELS.related_measurement,
    axis: relationship.axis,
    axisLabel: RELATIONSHIP_AXIS_LABELS[relationship.axis],
    description: relationship.description,
  };
}

function edgeSort(
  left: MeasurementRelationshipEdge,
  right: MeasurementRelationshipEdge,
): number {
  if (left.relationshipType !== right.relationshipType) {
    return left.relationshipType === "panel_member" ? -1 : 1;
  }
  return compareText(left.key, right.key);
}

function edgeSignature(edge: MeasurementRelationshipEdge): string {
  if (edge.relationshipType === "panel_member") {
    return `${edge.relationshipType}:${edge.source.key}:${edge.target.key}`;
  }
  const endpoints = [edge.source.key, edge.target.key].sort(compareText);
  return `${edge.relationshipType}:${edge.axis}:${endpoints.join(":")}`;
}

function identityAxisDiffers(
  source: MeasurementDefinition,
  target: MeasurementDefinition,
  axis: RelationshipAxis,
): boolean {
  if (axis !== "specimen" && source.specimen !== target.specimen) return false;
  if (axis !== "timing" && source.timing !== target.timing) return false;
  if (axis !== "property" && source.property !== target.property) return false;
  if (source.scale !== target.scale) return false;
  if (source.method !== target.method) return false;
  if (source.valueKind !== target.valueKind) return false;
  if (axis === "specimen") return source.specimen !== target.specimen;
  if (axis === "timing") return source.timing !== target.timing;
  return source.property !== target.property;
}

export function buildMeasurementRelationshipEdges(
  panels: readonly PanelDefinition[] = PANEL_DEFINITIONS,
  relationships: readonly CuratedMeasurementRelationship[] = CURATED_MEASUREMENT_RELATIONSHIPS,
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS,
): readonly MeasurementRelationshipEdge[] {
  const definitionsByKey =
    definitions === MEASUREMENT_DEFINITIONS
      ? MEASUREMENT_DEFINITIONS_BY_KEY
      : new Map(definitions.map((definition) => [definition.key, definition]));
  return [
    ...panels.flatMap((panel) =>
      panel.members.map((member) =>
        panelMemberEdge(panel, member, definitionsByKey),
      ),
    ),
    ...relationships.map(relatedMeasurementEdge),
  ].sort(edgeSort);
}

export const MEASUREMENT_RELATIONSHIP_EDGES: readonly MeasurementRelationshipEdge[] =
  buildMeasurementRelationshipEdges();

export function validateMeasurementRelationshipGraph(
  edges: readonly MeasurementRelationshipEdge[] = MEASUREMENT_RELATIONSHIP_EDGES,
  panels: readonly PanelDefinition[] = PANEL_DEFINITIONS,
  definitions: readonly MeasurementDefinition[] = MEASUREMENT_DEFINITIONS,
): MeasurementRelationshipGraphValidation {
  const errors: string[] = [];
  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.key, definition]),
  );
  const panelsByKey = new Map(panels.map((panel) => [panel.key, panel]));
  const seenKeys = new Set<string>();
  const seenSignatures = new Set<string>();

  if (!RELATED_MEASUREMENT_GRAPH_VERSION.trim())
    errors.push("Graph version must not be empty");

  for (const edge of edges) {
    if (seenKeys.has(edge.key))
      errors.push(`Duplicate relationship edge key: ${edge.key}`);
    seenKeys.add(edge.key);
    if (edge.version !== RELATED_MEASUREMENT_GRAPH_VERSION) {
      errors.push(`Relationship edge has an unexpected version: ${edge.key}`);
    }
    const signature = edgeSignature(edge);
    if (seenSignatures.has(signature))
      errors.push(`Duplicate relationship edge: ${signature}`);
    seenSignatures.add(signature);

    if (edge.relationshipType === "panel_member") {
      if (edge.source.kind !== "panel" || edge.target.kind !== "measurement") {
        errors.push(`Panel-member edge endpoints are invalid: ${edge.key}`);
        continue;
      }
      const panel = panelsByKey.get(edge.source.key);
      const member = panel?.members.find(
        (candidate) => candidate.measurementDefinitionKey === edge.target.key,
      );
      if (!panel || !member) {
        errors.push(
          `Panel-member edge does not match panel registry: ${edge.key}`,
        );
        continue;
      }
      if (
        member.role !== edge.role ||
        member.displayOrder !== edge.displayOrder
      ) {
        errors.push(
          `Panel-member edge metadata does not match panel registry: ${edge.key}`,
        );
      }
      const definition = definitionsByKey.get(edge.target.key);
      if (!isReviewedMeasurement(definition)) {
        errors.push(
          `Panel-member edge targets a non-reviewed definition: ${edge.key}`,
        );
      }
      continue;
    }

    if (
      edge.source.kind !== "measurement" ||
      edge.target.kind !== "measurement"
    ) {
      errors.push(
        `Related-measurement edge endpoints are invalid: ${edge.key}`,
      );
      continue;
    }
    if (edge.source.key === edge.target.key) {
      errors.push(`Related-measurement edge is a self-link: ${edge.key}`);
      continue;
    }
    const source = definitionsByKey.get(edge.source.key);
    const target = definitionsByKey.get(edge.target.key);
    if (!isReviewedMeasurement(source) || !isReviewedMeasurement(target)) {
      errors.push(
        `Related-measurement edge targets a non-reviewed definition: ${edge.key}`,
      );
      continue;
    }
    if (source.analyteKey !== target.analyteKey) {
      errors.push(`Related-measurement edge crosses analytes: ${edge.key}`);
    }
    if (!identityAxisDiffers(source, target, edge.axis)) {
      errors.push(
        `Related-measurement edge axis does not match identity: ${edge.key}`,
      );
    }
    if (!edge.description.trim())
      errors.push(`Related-measurement edge description is empty: ${edge.key}`);
  }

  const expectedPanelEdges = buildMeasurementRelationshipEdges(
    panels,
    [],
    definitions,
  ).filter(
    (edge): edge is PanelMemberRelationshipEdge =>
      edge.relationshipType === "panel_member",
  );
  const actualPanelKeys = new Set(
    edges
      .filter(
        (edge): edge is PanelMemberRelationshipEdge =>
          edge.relationshipType === "panel_member",
      )
      .map((edge) => edge.key),
  );
  for (const expected of expectedPanelEdges) {
    if (!actualPanelKeys.has(expected.key))
      errors.push(`Missing panel-member edge: ${expected.key}`);
  }
  const expectedPanelKeys = new Set(expectedPanelEdges.map((edge) => edge.key));
  for (const actual of actualPanelKeys) {
    if (!expectedPanelKeys.has(actual))
      errors.push(`Unexpected panel-member edge: ${actual}`);
  }

  return { valid: errors.length === 0, errors };
}

function stableValue(value: unknown): string {
  if (value === null || typeof value !== "object")
    return JSON.stringify(value) ?? "null";
  if (Array.isArray(value))
    return `[${value.map(stableValue).sort().join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
    .join(",")}}`;
}

function serializableEdge(edge: MeasurementRelationshipEdge) {
  return edge.relationshipType === "panel_member"
    ? {
        key: edge.key,
        version: edge.version,
        relationshipType: edge.relationshipType,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        description: edge.description,
        role: edge.role,
        displayOrder: edge.displayOrder,
      }
    : {
        key: edge.key,
        version: edge.version,
        relationshipType: edge.relationshipType,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        axis: edge.axis,
        axisLabel: edge.axisLabel,
        description: edge.description,
      };
}

export function serializeMeasurementRelationshipGraph(
  edges: readonly MeasurementRelationshipEdge[] = MEASUREMENT_RELATIONSHIP_EDGES,
  panels: readonly PanelDefinition[] = PANEL_DEFINITIONS,
): string {
  return stableValue({
    graphModel: "related-measurement-graph",
    graphVersion: RELATED_MEASUREMENT_GRAPH_VERSION,
    panelRegistryVersion: PANEL_REGISTRY_VERSION,
    edges: edges
      .map(serializableEdge)
      .sort((left, right) => compareText(left.key, right.key)),
    panels: panels.map((panel) => ({
      key: panel.key,
      displayName: panel.displayName,
      members: panel.members,
    })),
  });
}

export function digestMeasurementRelationshipGraph(
  edges: readonly MeasurementRelationshipEdge[] = MEASUREMENT_RELATIONSHIP_EDGES,
  panels: readonly PanelDefinition[] = PANEL_DEFINITIONS,
): string {
  return createHash("sha256")
    .update(serializeMeasurementRelationshipGraph(edges, panels))
    .digest("hex");
}

function nodeForRef(ref: RelationshipNodeRef): RelationshipNode | null {
  if (ref.kind === "panel") {
    const panel = panelsByKey.get(ref.key);
    return panel ? panelNode(panel) : null;
  }
  const definition = MEASUREMENT_DEFINITIONS_BY_KEY.get(ref.key);
  return definition ? measurementNode(ref.key) : null;
}

const panelsByKey = new Map(
  PANEL_DEFINITIONS.map((panel) => [panel.key, panel]),
);

function graphForRoot(
  root: RelationshipNode,
  edges: readonly MeasurementRelationshipEdge[],
): MeasurementRelationshipGraph {
  const nodes = new Map<string, RelationshipNode>([
    [`${root.kind}:${root.key}`, root],
  ]);
  for (const edge of edges) {
    const source = nodeForRef(edge.source);
    const target = nodeForRef(edge.target);
    if (source) nodes.set(`${source.kind}:${source.key}`, source);
    if (target) nodes.set(`${target.kind}:${target.key}`, target);
  }
  const orderedNodes = [...nodes.values()].filter(
    (node) =>
      (node.kind === root.kind && node.key === root.key) ||
      edges.some(
        (edge) =>
          (edge.source.kind === node.kind && edge.source.key === node.key) ||
          (edge.target.kind === node.kind && edge.target.key === node.key),
      ),
  );
  orderedNodes.sort((left, right) => {
    if (left.kind === root.kind && left.key === root.key) return -1;
    if (right.kind === root.kind && right.key === root.key) return 1;
    if (left.kind !== right.kind) return left.kind === "panel" ? -1 : 1;
    return compareText(left.key, right.key);
  });
  return {
    version: RELATED_MEASUREMENT_GRAPH_VERSION,
    root,
    nodes: orderedNodes,
    edges: [...edges].sort(edgeSort),
  };
}

export function listMeasurementRelationshipEdges(): readonly MeasurementRelationshipEdge[] {
  return MEASUREMENT_RELATIONSHIP_EDGES;
}

export function getMeasurementRelationshipGraph(
  measurementDefinitionKey: MeasurementDefinitionKey | null | undefined,
): MeasurementRelationshipGraph | null {
  const key = measurementDefinitionKey?.trim() ?? "";
  const definition = MEASUREMENT_DEFINITIONS_BY_KEY.get(key);
  if (!isReviewedMeasurement(definition)) return null;
  const edges = MEASUREMENT_RELATIONSHIP_EDGES.filter(
    (edge) =>
      (edge.source.kind === "measurement" && edge.source.key === key) ||
      (edge.target.kind === "measurement" && edge.target.key === key),
  );
  return graphForRoot(measurementNode(key), edges);
}

export function getPanelRelationshipGraph(
  panelKey: PanelKey | null | undefined,
): MeasurementRelationshipGraph | null {
  const key = panelKey?.trim() ?? "";
  const panel = panelsByKey.get(key);
  if (!panel) return null;
  const edges = MEASUREMENT_RELATIONSHIP_EDGES.filter(
    (edge) => edge.source.kind === "panel" && edge.source.key === key,
  );
  return graphForRoot(panelNode(panel), edges);
}

export const MEASUREMENT_RELATIONSHIP_GRAPH_DIGEST =
  digestMeasurementRelationshipGraph();

const defaultValidation = validateMeasurementRelationshipGraph();
if (!defaultValidation.valid) {
  throw new Error(
    `Invalid related measurement graph:\n${defaultValidation.errors.join("\n")}`,
  );
}
