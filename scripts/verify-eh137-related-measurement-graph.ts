import assert from "node:assert/strict";
import {
  getMeasurementDefinition,
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  getRegistryV2ScoreRole,
  resolveMeasurementDefinition,
  PANEL_DEFINITIONS,
  MEASUREMENT_DEFINITIONS,
  type MeasurementDefinition,
  type PanelDefinition,
} from "../src/lib/biomarkers";
import {
  CURATED_MEASUREMENT_RELATIONSHIPS,
  MEASUREMENT_RELATIONSHIP_EDGES,
  RELATED_MEASUREMENT_GRAPH_VERSION,
  buildMeasurementRelationshipEdges,
  digestMeasurementRelationshipGraph,
  getMeasurementRelationshipGraph,
  getPanelRelationshipGraph,
  listMeasurementRelationshipEdges,
  serializeMeasurementRelationshipGraph,
  validateMeasurementRelationshipGraph,
  type CuratedMeasurementRelationship,
} from "../src/lib/knowledge/measurement-relationship-graph";
import { GET as getRelationshipGraph } from "../src/app/api/knowledge/measurements/[key]/relationships/route";

// Synthetic reviewed-shaped fixtures keep the focused contract independent
// from the production catalog while production queries remain smoke-tested.
const SYNTHETIC_DEFINITION_BASE = {
  maturity: "reviewed" as const,
  sourceProvenance: {
    kind: "registry_v2_review" as const,
    sourceRecordKey: "eh137.synthetic",
  },
  property: "substance_concentration" as const,
  scale: "quantitative" as const,
  timing: "point_in_time" as const,
  method: "automated" as const,
  valueKind: "numeric" as const,
  aliases: [] as const,
  unitPolicy: {
    dimensions: ["molar_concentration"] as const,
    acceptedUnits: ["mmol/l"] as const,
    canonicalUnit: "mmol/l",
    conversionPolicyRef: null,
    missingUnitPolicy: "reject" as const,
  },
  assessmentBindings: [] as const,
};

const SYNTHETIC_DEFINITIONS: readonly MeasurementDefinition[] = [
  {
    ...SYNTHETIC_DEFINITION_BASE,
    key: "synthetic_alpha_serum",
    analyteKey: "synthetic_alpha",
    specimen: "serum" as const,
    displayName: "Synthetic alpha (serum)",
  },
  {
    ...SYNTHETIC_DEFINITION_BASE,
    key: "synthetic_alpha_plasma",
    analyteKey: "synthetic_alpha",
    specimen: "plasma" as const,
    displayName: "Synthetic alpha (plasma)",
  },
  {
    ...SYNTHETIC_DEFINITION_BASE,
    key: "synthetic_beta_plasma",
    analyteKey: "synthetic_beta",
    specimen: "plasma" as const,
    displayName: "Synthetic beta (plasma)",
  },
];

const SYNTHETIC_PANEL_DEFINITIONS: readonly PanelDefinition[] = [
  {
    key: "synthetic_panel",
    displayName: "Synthetic panel",
    alternateNames: [],
    members: [
      {
        measurementDefinitionKey: "synthetic_alpha_serum",
        role: "required",
        displayOrder: 10,
      },
      {
        measurementDefinitionKey: "synthetic_alpha_plasma",
        role: "optional",
        displayOrder: 20,
      },
    ],
  },
];

const SYNTHETIC_RELATIONSHIPS: readonly CuratedMeasurementRelationship[] = [
  {
    key: "synthetic-alpha-specimen",
    sourceMeasurementDefinitionKey: "synthetic_alpha_serum",
    targetMeasurementDefinitionKey: "synthetic_alpha_plasma",
    axis: "specimen",
    description:
      "The same synthetic analyte is represented with a different specimen axis.",
  },
];

const validation = validateMeasurementRelationshipGraph();
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.ok(
  CURATED_MEASUREMENT_RELATIONSHIPS.length >= 10,
  "curated graph needs explicit relationships",
);
assert.equal(
  listMeasurementRelationshipEdges(),
  MEASUREMENT_RELATIONSHIP_EDGES,
);
assert.ok(
  MEASUREMENT_RELATIONSHIP_EDGES.every(
    (edge) => edge.version === RELATED_MEASUREMENT_GRAPH_VERSION,
  ),
);

const hemoglobinGraph = getMeasurementRelationshipGraph(
  "hemoglobin_whole_blood",
);
assert.ok(hemoglobinGraph, "hemoglobin should have panel relationships");
assert.equal(hemoglobinGraph.root.key, "hemoglobin_whole_blood");
assert.deepEqual(
  hemoglobinGraph.edges
    .filter((edge) => edge.relationshipType === "panel_member")
    .map((edge) => edge.source.key),
  ["cbc", "iron_studies"],
  "shared measurements remain connected to every owning panel",
);

const altGraph = getMeasurementRelationshipGraph(
  "alt_serum_catalytic_activity",
);
assert.ok(altGraph, "ALT should have a relationship graph");
assert.equal(
  altGraph.edges.find((edge) => edge.relationshipType === "related_measurement")
    ?.axis,
  "specimen",
);
assert.equal(
  altGraph.edges.find((edge) => edge.relationshipType === "related_measurement")
    ?.target.key,
  "alt_plasma_catalytic_activity",
);

const cbcGraph = getPanelRelationshipGraph("cbc");
assert.ok(cbcGraph, "CBC should have a panel graph");
assert.equal(cbcGraph.root.kind, "panel");
assert.equal(
  cbcGraph.edges.filter((edge) => edge.relationshipType === "panel_member")
    .length,
  PANEL_DEFINITIONS.find((panel) => panel.key === "cbc")?.members.length,
);
assert.equal(getMeasurementRelationshipGraph("unknown_measurement"), null);
const nonReviewed = MEASUREMENT_DEFINITIONS.find(
  (definition) => definition.maturity !== "reviewed",
);
assert.ok(nonReviewed, "catalog fixture needs a non-reviewed definition");
assert.equal(getMeasurementRelationshipGraph(nonReviewed.key), null);

const syntheticEdges = buildMeasurementRelationshipEdges(
  SYNTHETIC_PANEL_DEFINITIONS,
  SYNTHETIC_RELATIONSHIPS,
);
const syntheticValidation = validateMeasurementRelationshipGraph(
  syntheticEdges,
  SYNTHETIC_PANEL_DEFINITIONS,
  SYNTHETIC_DEFINITIONS,
);
assert.equal(
  syntheticValidation.valid,
  true,
  syntheticValidation.errors.join("\n"),
);
assert.equal(
  syntheticEdges.find((edge) => edge.relationshipType === "related_measurement")
    ?.axis,
  "specimen",
);
assert.equal(
  syntheticEdges.filter((edge) => edge.relationshipType === "panel_member")
    .length,
  2,
);

const reversedEdges = [...syntheticEdges].reverse();
const reversedPanels = [...SYNTHETIC_PANEL_DEFINITIONS].reverse();
assert.equal(
  serializeMeasurementRelationshipGraph(
    syntheticEdges,
    SYNTHETIC_PANEL_DEFINITIONS,
  ),
  serializeMeasurementRelationshipGraph(reversedEdges, reversedPanels),
  "relationship serialization must be source-order independent",
);
assert.equal(
  digestMeasurementRelationshipGraph(
    syntheticEdges,
    SYNTHETIC_PANEL_DEFINITIONS,
  ),
  digestMeasurementRelationshipGraph(reversedEdges, reversedPanels),
  "relationship digest must be source-order independent",
);
assert.deepEqual(
  buildMeasurementRelationshipEdges(
    reversedPanels,
    [...SYNTHETIC_RELATIONSHIPS].reverse(),
  ),
  syntheticEdges,
  "relationship projection must be deterministic",
);

const duplicate = validateMeasurementRelationshipGraph(
  [...syntheticEdges, syntheticEdges[0]!],
  SYNTHETIC_PANEL_DEFINITIONS,
  SYNTHETIC_DEFINITIONS,
);
assert.equal(duplicate.valid, false, "duplicate edges must be rejected");
const relatedEdge = syntheticEdges.find(
  (edge) => edge.relationshipType === "related_measurement",
);
assert.ok(relatedEdge, "synthetic fixture needs a related measurement edge");
const crossAnalyte = {
  ...relatedEdge,
  key: "invalid-cross-analyte",
  target: { ...relatedEdge.target, key: "synthetic_beta_plasma" },
};
const crossAnalyteValidation = validateMeasurementRelationshipGraph(
  [...syntheticEdges, crossAnalyte],
  SYNTHETIC_PANEL_DEFINITIONS,
  SYNTHETIC_DEFINITIONS,
);
assert.equal(
  crossAnalyteValidation.valid,
  false,
  "cross-analyte edges must be rejected",
);
const invalidAxis = {
  ...relatedEdge,
  key: "invalid-axis",
  axis: "timing" as const,
};
const invalidAxisValidation = validateMeasurementRelationshipGraph(
  [...syntheticEdges, invalidAxis],
  SYNTHETIC_PANEL_DEFINITIONS,
  SYNTHETIC_DEFINITIONS,
);
assert.equal(
  invalidAxisValidation.valid,
  false,
  "mismatched axes must be rejected",
);

const resolverInput = {
  rawLabel: "Hemoglobin",
  rawUnit: "g/L",
  specimen: "whole_blood",
  valueKind: "numeric" as const,
};
const resolutionBefore = resolveMeasurementDefinition(resolverInput);
const scoreRoleBefore = getRegistryV2ScoreRole("hemoglobin_whole_blood");
const readinessBefore = getRegistryV2ScoreReadinessGroups("blood");
const contributionsBefore = getRegistryV2ScoreContributionGroups("blood");
getMeasurementRelationshipGraph("hemoglobin_whole_blood");
getPanelRelationshipGraph("cbc");
assert.deepEqual(resolveMeasurementDefinition(resolverInput), resolutionBefore);
assert.equal(getRegistryV2ScoreRole("hemoglobin_whole_blood"), scoreRoleBefore);
assert.deepEqual(getRegistryV2ScoreReadinessGroups("blood"), readinessBefore);
assert.deepEqual(
  getRegistryV2ScoreContributionGroups("blood"),
  contributionsBefore,
);

async function verifyApi() {
  const apiResponse = await getRelationshipGraph(
    new Request(
      "http://easyhealth.internal/api/knowledge/measurements/alt_serum_catalytic_activity/relationships",
    ),
    { params: Promise.resolve({ key: "alt_serum_catalytic_activity" }) },
  );
  const apiPayload = await apiResponse.json();
  assert.equal(apiResponse.status, 200);
  assert.equal(apiPayload.version, RELATED_MEASUREMENT_GRAPH_VERSION);
  assert.ok(Array.isArray(apiPayload.edges));
  assert.equal("profileId" in apiPayload, false);
  assert.equal("observations" in apiPayload, false);

  const missingResponse = await getRelationshipGraph(
    new Request(
      "http://easyhealth.internal/api/knowledge/measurements/missing/relationships",
    ),
    { params: Promise.resolve({ key: "missing" }) },
  );
  assert.equal(missingResponse.status, 404);
  assert.equal(
    getMeasurementDefinition(apiPayload.root.key)?.maturity,
    "reviewed",
  );

  console.log(
    `eh137-related-measurement-graph: ${MEASUREMENT_RELATIONSHIP_EDGES.length} edges, ${RELATED_MEASUREMENT_GRAPH_VERSION}`,
  );
}

void verifyApi().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
