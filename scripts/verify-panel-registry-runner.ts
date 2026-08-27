import assert from "node:assert/strict";
import {
  MEASUREMENT_DEFINITIONS,
  PANEL_DEFINITIONS,
  REQUIRED_PANEL_KEYS,
  getMeasurementDefinition,
  getPanelDefinition,
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  getRegistryV2ScoreRole,
  listPanelDefinitions,
  listPanelsForMeasurementDefinition,
  resolveMeasurementDefinition,
  validatePanelRegistry,
  type PanelDefinition,
} from "../src/lib/biomarkers";
import {
  digestMeasurementRegistryManifest,
  serializeMeasurementRegistryManifest,
} from "../src/lib/biomarkers/measurement-registry-release";

const validation = validatePanelRegistry();
assert.equal(validation.valid, true, validation.errors.join("\n"));
assert.deepEqual(PANEL_DEFINITIONS.map((panel) => panel.key), REQUIRED_PANEL_KEYS);
assert.equal(listPanelDefinitions(), PANEL_DEFINITIONS);

for (const panel of PANEL_DEFINITIONS) {
  assert.equal(getPanelDefinition(panel.key), panel);
  assert.ok(panel.members.length > 0, `${panel.key} must not be empty`);
  assert.deepEqual(
    panel.members.map((member) => member.displayOrder),
    [...panel.members.map((member) => member.displayOrder)].sort((left, right) => left - right),
    `${panel.key} members must be ordered`,
  );
  for (const member of panel.members) {
    const definition = getMeasurementDefinition(member.measurementDefinitionKey);
    assert.ok(definition, `${panel.key}/${member.measurementDefinitionKey} must exist`);
    assert.equal(definition.maturity, "reviewed", `${panel.key}/${member.measurementDefinitionKey} must be reviewed`);
    assert.equal(definition.sourceProvenance.kind, "registry_v2_review");
  }
}

assert.deepEqual(
  listPanelsForMeasurementDefinition("hemoglobin_whole_blood").map((panel) => panel.key),
  ["cbc", "iron_studies"],
  "a concrete definition can belong to multiple panels",
);
assert.deepEqual(listPanelsForMeasurementDefinition(null), []);
assert.equal(getPanelDefinition(null), null);

const beforeResolution = resolveMeasurementDefinition({
  rawLabel: "Hemoglobin",
  rawUnit: "g/L",
  specimen: "whole_blood",
  valueKind: "numeric",
});
const beforeRole = getRegistryV2ScoreRole("hemoglobin_whole_blood");
const beforeReadiness = getRegistryV2ScoreReadinessGroups("blood");
const beforeContribution = getRegistryV2ScoreContributionGroups("blood");
listPanelsForMeasurementDefinition("hemoglobin_whole_blood");
const afterResolution = resolveMeasurementDefinition({
  rawLabel: "Hemoglobin",
  rawUnit: "g/L",
  specimen: "whole_blood",
  valueKind: "numeric",
});
assert.deepEqual(afterResolution, beforeResolution, "panel lookup must not change resolution");
assert.equal(getRegistryV2ScoreRole("hemoglobin_whole_blood"), beforeRole, "panel lookup must not change score role");
assert.deepEqual(getRegistryV2ScoreReadinessGroups("blood"), beforeReadiness, "panel lookup must not change readiness");
assert.deepEqual(getRegistryV2ScoreContributionGroups("blood"), beforeContribution, "panel lookup must not change contribution groups");

const canonicalManifest = serializeMeasurementRegistryManifest();
assert.equal(
  canonicalManifest,
  serializeMeasurementRegistryManifest([...MEASUREMENT_DEFINITIONS].reverse(), [...PANEL_DEFINITIONS].reverse()),
  "source-array ordering must not affect the canonical manifest",
);
const changedPanels: readonly PanelDefinition[] = PANEL_DEFINITIONS.map((panel) =>
  panel.key === "cbc"
    ? { ...panel, members: panel.members.map((member) => member.displayOrder === 10 ? { ...member, role: "optional" } : member) }
    : panel,
);
assert.notEqual(
  digestMeasurementRegistryManifest(),
  digestMeasurementRegistryManifest(MEASUREMENT_DEFINITIONS, changedPanels),
  "membership changes must invalidate the manifest digest",
);

const invalidRegistry: readonly PanelDefinition[] = [
  ...PANEL_DEFINITIONS,
  { ...PANEL_DEFINITIONS[0]!, key: "cbc" },
];
assert.equal(validatePanelRegistry(invalidRegistry).valid, false, "duplicate panel keys must be rejected");
assert.equal(
  validatePanelRegistry([
    { ...PANEL_DEFINITIONS[0]!, alternateNames: [PANEL_DEFINITIONS[0]!.displayName] },
    ...PANEL_DEFINITIONS.slice(1),
  ]).valid,
  false,
  "duplicate panel aliases must be rejected",
);
assert.equal(
  validatePanelRegistry([
    { ...PANEL_DEFINITIONS[0]!, members: [{ measurementDefinitionKey: "missing" as never, role: "required", displayOrder: 1 }] },
    ...PANEL_DEFINITIONS.slice(1),
  ]).valid,
  false,
  "missing member definitions must be rejected",
);
assert.equal(
  validatePanelRegistry([
    {
      ...PANEL_DEFINITIONS[0]!,
      members: [
        PANEL_DEFINITIONS[0]!.members[0]!,
        { ...PANEL_DEFINITIONS[0]!.members[0]!, displayOrder: 20 },
      ],
    },
    ...PANEL_DEFINITIONS.slice(1),
  ]).valid,
  false,
  "duplicate panel members and display orders must be rejected",
);
assert.equal(
  validatePanelRegistry([
    {
      ...PANEL_DEFINITIONS[0]!,
      members: [{ measurementDefinitionKey: "iron" as never, role: "required", displayOrder: 1 }],
    },
    ...PANEL_DEFINITIONS.slice(1),
  ]).valid,
  false,
  "Registry v1 keys must not be admitted as panel members",
);
assert.equal(
  validatePanelRegistry(
    PANEL_DEFINITIONS,
    MEASUREMENT_DEFINITIONS.map((definition) =>
      definition.key === "hemoglobin_whole_blood" ? { ...definition, maturity: "provisional" as const } : definition,
    ),
  ).valid,
  false,
  "unreviewed definitions must not be admitted as panel members",
);

console.log(`panel-registry: ${PANEL_DEFINITIONS.length} panels, ${PANEL_DEFINITIONS.flatMap((panel) => panel.members).length} memberships`);
