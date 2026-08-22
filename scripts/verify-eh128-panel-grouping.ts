import assert from "node:assert/strict";
import {
  MEASUREMENT_DEFINITIONS,
  PANEL_DEFINITIONS,
  getMeasurementDefinition,
} from "../src/lib/biomarkers";
import {
  buildObservationSourceHref,
  groupLaboratoryObservations,
  type TimelineLaboratoryObservation,
} from "../src/lib/timeline/panel-grouping";

const panelMemberKeys = new Set(
  PANEL_DEFINITIONS.flatMap((panel) =>
    panel.members.map((member) => member.measurementDefinitionKey),
  ),
);
const nonPanelDefinition = MEASUREMENT_DEFINITIONS.find(
  (definition) => !panelMemberKeys.has(definition.key),
);
assert.ok(nonPanelDefinition, "the fixture needs a reviewed non-panel definition");

function observation(
  id: string,
  measurementDefinitionKey: string | null,
  overrides: Partial<TimelineLaboratoryObservation> = {},
): TimelineLaboratoryObservation {
  return {
    id,
    document_id: "doc-eh128",
    measurement_definition_key: measurementDefinitionKey,
    name: getMeasurementDefinition(measurementDefinitionKey ?? "")?.displayName ?? id,
    value: 10,
    value_kind: "numeric",
    value_text: null,
    unit: "unit",
    ref_low: null,
    ref_high: null,
    observed_at: "2026-08-10",
    ordinal: null,
    source_page: 1,
    source_text: null,
    specimen: "whole_blood",
    modifier: "none",
    ...overrides,
  };
}

const input: TimelineLaboratoryObservation[] = [
  observation("unresolved", null, {
    name: "CBC-looking source label",
    value: null,
    value_kind: "qualitative",
    value_text: "not stated",
    source_page: null,
  }),
  observation("wbc", "wbc_whole_blood", { ordinal: 40 }),
  observation("non-panel", nonPanelDefinition.key, { ordinal: 60 }),
  observation("hemoglobin", "hemoglobin_whole_blood", { ordinal: 10, source_page: 2 }),
  observation("iron", "iron_serum", { ordinal: 50 }),
  observation("hematocrit", "hematocrit_whole_blood", { ordinal: 20 }),
];
const sourceOrder = input.map((row) => row.id);
const grouped = groupLaboratoryObservations(input);

assert.deepEqual(
  grouped.panels.map((group) => group.panel.key),
  ["cbc", "iron_studies"],
  "only panels with observed member definitions are detected in registry order",
);

const cbc = grouped.panels[0]!;
assert.deepEqual(
  cbc.members.slice(0, 5).map((member) => member.member.measurementDefinitionKey),
  [
    "hemoglobin_whole_blood",
    "hematocrit_whole_blood",
    "rbc_whole_blood",
    "wbc_whole_blood",
    "platelets_whole_blood",
  ],
  "CBC members remain in display order, including absent members",
);
assert.equal(cbc.reportedMemberCount, 3);
assert.equal(cbc.missingMemberCount, cbc.members.length - 3);
assert.equal(
  cbc.members.find((member) => member.member.measurementDefinitionKey === "rbc_whole_blood")?.missing,
  true,
  "missing required members are represented as neutral missing metadata",
);
assert.equal(
  cbc.members.find((member) => member.member.measurementDefinitionKey === "mcv_whole_blood")?.roleLabel,
  "Optional",
);

const ironStudies = grouped.panels.find((group) => group.panel.key === "iron_studies")!;
assert.deepEqual(
  ironStudies.members
    .find((member) => member.member.measurementDefinitionKey === "hemoglobin_whole_blood")
    ?.observations.map((row) => row.id),
  ["hemoglobin"],
  "shared hemoglobin remains visible in iron studies",
);
assert.equal(
  grouped.ungrouped.some((row) => row.id === "hemoglobin"),
  false,
  "panel-assigned rows are not repeated in the ungrouped section",
);
assert.deepEqual(
  grouped.ungrouped.map((row) => row.id),
  ["non-panel", "unresolved"],
  "unresolved and non-panel measurements remain visible",
);
assert.deepEqual(input.map((row) => row.id), sourceOrder, "grouping does not mutate source order");

const reordered = groupLaboratoryObservations([...input].reverse());
assert.deepEqual(
  reordered.panels.map((group) =>
    [group.panel.key, ...group.members.flatMap((member) => member.observations.map((row) => row.id))],
  ),
  grouped.panels.map((group) =>
    [group.panel.key, ...group.members.flatMap((member) => member.observations.map((row) => row.id))],
  ),
  "source-array order does not change the projection",
);

assert.equal(
  buildObservationSourceHref("doc-eh128", 2),
  "/app/documents/doc-eh128?page=2",
);
assert.equal(
  buildObservationSourceHref("doc-eh128", 0),
  "/app/documents/doc-eh128",
);
assert.equal(buildObservationSourceHref(null, 2), null);

console.log(
  `eh128-panel-grouping: ${grouped.panels.length} panels, ${grouped.ungrouped.length} ungrouped observations`,
);
