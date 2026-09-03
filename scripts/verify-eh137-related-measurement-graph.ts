import assert from "node:assert/strict";
import {
  getMeasurementDefinition,
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  getRegistryV2ScoreRole,
  resolveMeasurementDefinition,
  PANEL_DEFINITIONS,
  MEASUREMENT_DEFINITIONS,
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
} from "../src/lib/knowledge/measurement-relationship-graph";
import { GET as getRelationshipGraph } from "../src/app/api/knowledge/measurements/[key]/relationships/route";

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

const reversedEdges = [...MEASUREMENT_RELATIONSHIP_EDGES].reverse();
const reversedPanels = [...PANEL_DEFINITIONS].reverse();
assert.equal(
  serializeMeasurementRelationshipGraph(),
  serializeMeasurementRelationshipGraph(reversedEdges, reversedPanels),
  "relationship serialization must be source-order independent",
);
assert.equal(
  digestMeasurementRelationshipGraph(),
  digestMeasurementRelationshipGraph(reversedEdges, reversedPanels),
  "relationship digest must be source-order independent",
);
assert.deepEqual(
  buildMeasurementRelationshipEdges(
    reversedPanels,
    [...CURATED_MEASUREMENT_RELATIONSHIPS].reverse(),
  ),
  MEASUREMENT_RELATIONSHIP_EDGES,
  "relationship projection must be deterministic",
);

const duplicate = validateMeasurementRelationshipGraph([
  ...MEASUREMENT_RELATIONSHIP_EDGES,
  MEASUREMENT_RELATIONSHIP_EDGES[0]!,
]);
assert.equal(duplicate.valid, false, "duplicate edges must be rejected");
const relatedEdge = MEASUREMENT_RELATIONSHIP_EDGES.find(
  (edge) => edge.relationshipType === "related_measurement",
);
assert.ok(relatedEdge, "fixture needs a related measurement edge");
const crossAnalyte = {
  ...relatedEdge,
  key: "invalid-cross-analyte",
  target: { ...relatedEdge.target, key: "glucose_serum" },
};
const crossAnalyteValidation = validateMeasurementRelationshipGraph([
  ...MEASUREMENT_RELATIONSHIP_EDGES,
  crossAnalyte,
]);
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
const invalidAxisValidation = validateMeasurementRelationshipGraph([
  ...MEASUREMENT_RELATIONSHIP_EDGES,
  invalidAxis,
]);
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
