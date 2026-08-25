/**
 * EH-145 score-provenance render smoke test.
 *
 * Renders the real `ScoreProvenancePanel` and `ExcludedObservationsPanel`
 * against deterministic synthetic fixtures and asserts the observable
 * explanation contract: algorithm version, readiness groups, contributors with
 * source page evidence, page-only labeling for non-exact regions, machine
 * exclusion reasons, the null-score state, and the legacy no-provenance state.
 *
 * Run: pnpm smoke:eh145
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildHealthProfile,
  type ObservationInput,
  type ScoreExclusion,
} from "../src/lib/health-systems";
import { buildSourceRegion } from "../src/lib/documents/source-region";

// tsx compiles JSX with the classic runtime, so the components' JSX needs a
// global React (same requirement as the EH-121 history-panel smoke).
const globalScope = globalThis as unknown as { React: typeof React };
globalScope.React = React;
const { ScoreProvenancePanel, ExcludedObservationsPanel } = await import(
  "../src/components/score-provenance-panel"
);

const source = {
  id: "eh145-smoke-document",
  original_filename: "eh145-smoke.pdf",
  observed_at: "2026-08-01",
  lab_name: "Synthetic laboratory",
  document_type: "lab_result",
};

const exactRegion = buildSourceRegion({
  page: 2,
  bbox: { x: 0.1, y: 0.2, w: 0.2, h: 0.02 },
  match: {
    strategy: "exact",
    score: 1,
    engine: "pdf-text-bbox",
    resolver_version: "eh145-smoke",
  },
});
assert.ok(exactRegion, "fixture source region should be valid");

function observation(overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    observation_id: "obs-hba1c",
    biomarker_key: "hba1c",
    measurement_definition_key: "hba1c_whole_blood",
    resolution_status: "resolved",
    name: "Hemoglobin A1c",
    value: 5.4,
    unit: "%",
    ref_low: 4,
    ref_high: 5.6,
    observed_at: "2026-08-01",
    document_id: source.id,
    observation_kind: "lab",
    value_kind: "numeric",
    value_text: "5.4",
    specimen: "whole_blood",
    modifier: "none",
    source_page: 2,
    source_text: "Hemoglobin A1c 5.4 % 4.0-5.6",
    source_region: exactRegion,
    ...overrides,
  };
}

const glucose = observation({
  observation_id: "obs-glucose",
  biomarker_key: "glucose",
  measurement_definition_key: "glucose_serum",
  name: "Glucose",
  value: 90,
  unit: "mg/dL",
  ref_low: 70,
  ref_high: 99,
  specimen: "serum",
  source_page: 1,
  source_text: "Glucose 90 mg/dL 70-99",
  source_region: null,
});

const preProjectionExclusion: ScoreExclusion = {
  observation_id: "obs-unmapped",
  system_id: "general",
  key: "mystery_result",
  measurement_definition_key: null,
  name: "Unmapped result",
  value: null,
  value_text: "pending",
  unit: "",
  ref_low: null,
  ref_high: null,
  status: "unknown",
  observed_at: "2026-08-01",
  document_id: source.id,
  source,
  source_page: null,
  source_text: "Unmapped result pending review",
  source_region: null,
  reason: "incomplete_resolution",
  reason_detail: "axis_not_stated",
  contribution_group: null,
};

const profile = buildHealthProfile(
  [observation(), glucose],
  [source],
  { excludedObservations: [preProjectionExclusion] },
);
const metabolic = profile.systems.find((system) => system.id === "metabolic");
assert.ok(metabolic, "metabolic system should be rendered");

const scored = renderToStaticMarkup(
  React.createElement(ScoreProvenancePanel, {
    systemId: metabolic.id,
    stateScore: metabolic.state_score,
    provenance: metabolic.score_provenance,
    navigationReturnTo: "/app/profile",
  }),
);
for (const expected of [
  "How this assessment was calculated",
  "eh145-score-v1",
  "Readiness groups",
  "Contributors",
  "Glucose",
  "glycemia",
  "/100",
  "70–99",
  "Page 1",
  "Page-only source evidence",
  "Open source document",
  "page=1",
  "Another marker represents this contribution group",
  "Page 2",
  "Exact source region",
]) {
  assert.ok(scored.includes(expected), `scored panel must include ${expected}`);
}
assert.ok(
  scored.indexOf("Excluded observations") <
    scored.indexOf("Hemoglobin A1c</p>") &&
    scored.indexOf("Hemoglobin A1c</p>") <
    scored.indexOf("Another marker represents this contribution group"),
  "the duplicate alternative must be excluded with its machine reason",
);

const incompleteProfile = buildHealthProfile([glucose], [source]);
const incompleteMetabolic = incompleteProfile.systems.find(
  (system) => system.id === "metabolic",
);
assert.ok(incompleteMetabolic, "incomplete metabolic system should be rendered");
const nullScore = renderToStaticMarkup(
  React.createElement(ScoreProvenancePanel, {
    systemId: incompleteMetabolic.id,
    stateScore: incompleteMetabolic.state_score,
    provenance: incompleteMetabolic.score_provenance,
  }),
);
for (const expected of [
  "No numeric score is available",
  "Missing",
  "Score unavailable until readiness is complete",
  "No observations contributed to a numeric score",
]) {
  assert.ok(nullScore.includes(expected), `null-score panel must include ${expected}`);
}
assert.ok(!nullScore.includes("/100"), "a null score must not display a numeric score");

const pageOnlyExclusion: ScoreExclusion = {
  ...preProjectionExclusion,
  observation_id: "obs-no-page",
  source_page: 4,
};
const global = renderToStaticMarkup(
  React.createElement(ExcludedObservationsPanel, {
    provenance: {
      algorithm_version: "eh145-score-v1",
      excluded_observations: [preProjectionExclusion, pageOnlyExclusion],
    },
    navigationReturnTo: "/app/profile",
  }),
);
for (const expected of [
  "Observations not used in a score (2)",
  "Resolution is incomplete",
  "axis_not_stated",
  "Source page unavailable",
  "Page-only source evidence",
]) {
  assert.ok(global.includes(expected), `global exclusion panel must include ${expected}`);
}

const legacy = renderToStaticMarkup(
  React.createElement(ExcludedObservationsPanel, { provenance: null }),
);
assert.equal(legacy, "", "a legacy payload without provenance renders no fabricated panel");

const legacyDrawer = renderToStaticMarkup(
  React.createElement(ScoreProvenancePanel, {
    systemId: "metabolic",
    stateScore: 72,
    provenance: null,
  }),
);
const { HealthProfileDrawer } = await import("../src/components/health-profile-drawer");
const drawer = renderToStaticMarkup(
  React.createElement(HealthProfileDrawer, {
    system: metabolic,
    layoutLabel: "Metabolic",
    open: true,
    onClose: () => {},
  }),
);
for (const expected of [
  "How this assessment was calculated",
  "eh145-score-v1",
  "Why highlighted",
  "Open source document",
]) {
  assert.ok(drawer.includes(expected), `drawer must integrate the provenance panel (${expected})`);
}

assert.equal(legacyDrawer, "", "a legacy system without provenance renders no fabricated panel");

mkdirSync(".artifacts", { recursive: true });
writeFileSync(
  ".artifacts/eh145-provenance-panel.html",
  `<!doctype html><meta charset="utf-8">
<title>EH-145 provenance panel render smoke</title>
<style>body{font-family:system-ui;margin:2rem;display:grid;gap:2rem;max-width:60rem}</style>
<h1>Scored system</h1>${scored}
<h1>Null score</h1>${nullScore}
<h1>Global exclusions</h1>${global}`,
);
console.log("smoke:eh145: all render checks passed; wrote .artifacts/eh145-provenance-panel.html");
