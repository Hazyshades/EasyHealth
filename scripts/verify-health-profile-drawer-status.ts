import assert from "node:assert/strict";
import React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HealthProfileDrawer } from "../src/components/health-profile-drawer";
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

function renderDrawer(system: SystemInsight): string {
  return renderToStaticMarkup(
    createElement(HealthProfileDrawer, {
      system,
      layoutLabel: "Cardiovascular",
      open: true,
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
      reasons: [{ code: "missing", required_group: ["ldl_cholesterol"], present_keys: [] }],
    },
  }),
);
assert.ok(
  incomplete.includes(">Assessment unavailable<"),
  "incomplete system must render the canonical unavailable label",
);
assert.doesNotMatch(incomplete, EMPTY_CHIP_PATTERN, "chip must never render empty");

const scored = renderDrawer(
  fixtureSystem({ state_score: 90, scoreability: "scoreable" }),
);
assert.ok(
  scored.includes(">Stable<"),
  "scored system must render its canonical numeric-derived label",
);
assert.doesNotMatch(scored, EMPTY_CHIP_PATTERN, "chip must never render empty");

const outdated = renderDrawer(
  fixtureSystem({
    score_readiness: {
      required_groups: [],
      reasons: [{ code: "outdated", required_group: null, present_keys: [] }],
    },
  }),
);
assert.ok(
  outdated.includes(">Assessment unavailable<"),
  "outdated system must withhold its score behind the canonical label",
);
assert.ok(
  outdated.includes("Health Profile assessment is updating"),
  "outdated system must show the shared updating headline",
);
assert.ok(
  outdated.includes("The previous score is not shown as current"),
  "outdated system must explain that the previous score is withheld",
);
assert.doesNotMatch(outdated, EMPTY_CHIP_PATTERN, "chip must never render empty");

console.log("verify-health-profile-drawer-status: all checks passed");
