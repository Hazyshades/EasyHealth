import assert from "node:assert/strict";
import React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HealthProfileDrawer } from "../src/components/health-profile-drawer";
import { type HealthProfileAssessmentDisplayState } from "../src/lib/health-profile-assessment-state";
import {
  type SystemInsight,
  type SystemMarker,
} from "../src/lib/health-systems";

/**
 * Guards the drawer's assessment status chip against DOM-global shadowing.
 * Regression context: dropping the local `status` binding made the JSX
 * identifier resolve to `window.status` (empty string) while typecheck kept
 * passing, because lib.dom declares a global `var status: string`.
 */

// The drawer's TSX compiles to the classic JSX runtime outside Next's build,
// so the bare `React` identifier must resolve at render time.
(globalThis as unknown as Record<string, unknown>).React = React;

const MARKER: SystemMarker = {
  key: "ldl_cholesterol",
  measurement_definition_key: "ldl_cholesterol",
  name: "LDL cholesterol",
  value: 50,
  unit: "fixture-unit",
  ref_low: 0,
  ref_high: 100,
  status: "in_range",
  freshness_status: "current",
  observed_at: "2026-08-01",
  document_id: null,
  source: null,
};

function fixtureSystem(overrides: Partial<SystemInsight>): SystemInsight {
  return {
    id: "cardiovascular",
    name: "Cardiovascular",
    state_score: null,
    data_confidence: 80,
    scoreability: "incomplete",
    score_readiness: { required_groups: [], reasons: [] },
    score_provenance: {
      algorithm_version: "fixture-score-v1",
      readiness_groups: [],
      contributors: [],
      excluded: [],
    },
    primary_source: null,
    why_highlighted: [],
    markers: [MARKER],
    ...overrides,
  };
}

function renderDrawer(
  system: SystemInsight,
  assessmentLifecycleState: HealthProfileAssessmentDisplayState = "current",
): string {
  return renderToStaticMarkup(
    createElement(HealthProfileDrawer, {
      system,
      layoutLabel: "Cardiovascular",
      open: true,
      assessmentLifecycleState,
      onClose: () => {},
    }),
  );
}

// An empty status chip renders as `<span class="... text-xs font-medium"></span>`.
const EMPTY_CHIP_PATTERN = /text-xs font-medium"><\/span>/;

const incomplete = renderDrawer(
  fixtureSystem({
    score_readiness: {
      required_groups: [],
      reasons: [
        {
          code: "missing",
          required_group: ["ldl_cholesterol"],
          present_keys: [],
        },
      ],
    },
  }),
);
assert.ok(
  incomplete.includes(">Assessment unavailable<"),
  "incomplete system must render the canonical unavailable label",
);
assert.doesNotMatch(
  incomplete,
  EMPTY_CHIP_PATTERN,
  "chip must never render empty",
);

const scored = renderDrawer(
  fixtureSystem({ state_score: 90, scoreability: "scoreable" }),
);
assert.ok(
  scored.includes(">Stable<"),
  "scored system must render its canonical numeric-derived label",
);
assert.doesNotMatch(scored, EMPTY_CHIP_PATTERN, "chip must never render empty");

const updating = renderDrawer(
  fixtureSystem({
    state_score: 90,
    scoreability: "scoreable",
    score_readiness: {
      required_groups: [],
      reasons: [],
    },
  }),
  "outdated",
);
assert.ok(
  updating.includes(">Stable<"),
  "an assessment update must not suppress the completed score",
);
assert.ok(
  updating.includes("Assessment update available"),
  "outdated lifecycle state must show the shared update label",
);
assert.ok(
  updating.includes(
    "latest completed current-state assessment remains visible",
  ),
  "outdated lifecycle state must explain that the completed score remains visible",
);
assert.ok(
  updating.includes("90/100"),
  "outdated lifecycle state must retain the completed numeric score",
);
assert.doesNotMatch(
  updating,
  /Assessment unavailable/,
  "an outdated lifecycle state must not relabel a retained score as unavailable",
);
assert.doesNotMatch(
  updating,
  EMPTY_CHIP_PATTERN,
  "chip must never render empty",
);

const stale = renderDrawer(
  fixtureSystem({
    state_score: null,
    markers: [{ ...MARKER, freshness_status: "outdated" }],
    score_readiness: {
      required_groups: [],
      reasons: [
        {
          code: "outdated",
          required_group: ["ldl_cholesterol"],
          present_keys: ["ldl_cholesterol"],
        },
      ],
    },
  }),
);
assert.ok(
  stale.includes(">Not scored - outdated data<"),
  "stale evidence must remain distinct from an assessment lifecycle update",
);
assert.ok(
  stale.includes(
    "Required observations older than the current assessment policy do not unlock a numeric score",
  ),
  "stale evidence must explain why no score is available",
);

const unknownDate = renderDrawer(
  fixtureSystem({
    markers: [
      { ...MARKER, observed_at: null, freshness_status: "unknown_date" },
    ],
    score_readiness: {
      required_groups: [],
      reasons: [
        { code: "unknown_date", required_group: null, present_keys: [] },
      ],
    },
  }),
);
assert.ok(
  unknownDate.includes(">Not scored - date unavailable<"),
  "unknown-date markers must expose one semantic date-unavailable state",
);
assert.equal(
  (unknownDate.match(/Currentness could not be evaluated/g) ?? []).length,
  1,
  "unknown-date markers must render one semantic freshness label",
);
assert.equal(
  (
    unknownDate.match(
      /A required observation has no available medical date/g,
    ) ?? []
  ).length,
  1,
  "unknown-date markers must render one factual explanation",
);
assert.equal(
  (unknownDate.match(/Observed date unavailable/g) ?? []).length,
  0,
  "legacy duplicate date-unavailable copy must not return",
);

console.log("verify-health-profile-drawer-status: all checks passed");
