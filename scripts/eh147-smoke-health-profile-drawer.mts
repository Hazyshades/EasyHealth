/**
 * EH-147 Health Profile drawer smoke: render the real drawer against golden
 * production outputs. Proves UI-01/UI-02 copy without a browser.
 *
 * Run: pnpm smoke:eh147
 */
import assert from "node:assert/strict";
import React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HealthProfileDrawer } from "../src/components/health-profile-drawer";
import {
  buildHealthProfile,
  type ObservationInput,
} from "../src/lib/health-systems";
import {
  EH147_DOCUMENT_ID,
  EH147_FRESHNESS_AS_OF,
  EH147_FRESHNESS_EVALUATED_AT,
  listGoldenCases,
} from "./eh147-golden-pack";

const globalScope = globalThis as unknown as { React: typeof React };
globalScope.React = React;

const SOURCE = {
  id: EH147_DOCUMENT_ID,
  original_filename: "eh147-synthetic-labs.pdf",
  observed_at: EH147_FRESHNESS_AS_OF,
  lab_name: "Synthetic laboratory",
  document_type: "lab_result",
} as const;

const SCOREABLE = [
  "cardiovascular",
  "metabolic",
  "thyroid",
  "liver",
  "kidney",
  "blood",
  "nutrients",
] as const;

function renderDrawer(system: ReturnType<typeof buildHealthProfile>["systems"][number]) {
  return renderToStaticMarkup(
    createElement(HealthProfileDrawer, {
      system,
      layoutLabel: system.name,
      open: true,
      onClose: () => {},
    }),
  );
}

function profileFrom(observations: readonly ObservationInput[]) {
  return buildHealthProfile([...observations], [SOURCE], {
    freshnessAsOf: EH147_FRESHNESS_AS_OF,
    freshnessEvaluatedAt: EH147_FRESHNESS_EVALUATED_AT,
  });
}

const cases = listGoldenCases();
const complete = cases.find((goldenCase) => goldenCase.id === "complete-in-range-eight-systems");
assert.ok(complete?.observations, "complete in-range case missing");
const completeProfile = profileFrom(complete.observations);

for (const systemId of SCOREABLE) {
  const system = completeProfile.systems.find((item) => item.id === systemId);
  assert.ok(system, `${systemId} missing from complete profile`);
  const html = renderDrawer(system);
  assert.notEqual(system.state_score, null, `${systemId} must have a numeric score`);
  assert.ok(html.includes(`${system.state_score}/100`), `${systemId} drawer must show the numeric score`);
  assert.ok(html.includes("Current state assessment"), `${systemId} must label the score factually`);
  assert.doesNotMatch(html, /diagnos/i, `${systemId} must not call the score a diagnosis`);
  assert.doesNotMatch(html, />0\/100</, `${systemId} must not render a zero placeholder score`);
}

const inflammation = completeProfile.systems.find((item) => item.id === "inflammation");
assert.ok(inflammation);
assert.equal(inflammation.state_score, null);
assert.equal(inflammation.scoreability, "non_scoreable");
const inflammationHtml = renderDrawer(inflammation);
assert.ok(inflammationHtml.includes("—"), "inflammation must render an em dash, not 0");
assert.ok(
  inflammationHtml.includes("Not scored - individual markers only"),
  "inflammation remains factual-only",
);

const missing = cases.find((goldenCase) => goldenCase.id === "missing-group-thyroid");
assert.ok(missing?.observations, "missing-group-thyroid case missing");
const missingProfile = profileFrom(missing.observations);
const thyroid = missingProfile.systems.find((item) => item.id === "thyroid");
assert.ok(thyroid);
assert.equal(thyroid.state_score, null);
assert.equal(thyroid.scoreability, "incomplete");
const thyroidHtml = renderDrawer(thyroid);
assert.ok(thyroidHtml.includes("—"));
assert.ok(thyroidHtml.includes("Assessment unavailable"));
assert.ok(thyroidHtml.includes("Not scored - incomplete core"));
assert.ok(thyroidHtml.includes("Needed for this assessment"));
assert.doesNotMatch(thyroidHtml, />0\/100</);
assert.ok(thyroid.markers.length > 0, "present thyroid markers remain visible");

const cardiovascular = missingProfile.systems.find((item) => item.id === "cardiovascular");
assert.ok(cardiovascular);
assert.notEqual(cardiovascular.state_score, null, "complete systems may still score");

console.log("eh147-smoke-health-profile-drawer: UI-01 and UI-02 copy checks passed");
