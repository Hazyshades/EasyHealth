/**
 * Enforces the catalog precondition behind the score/readiness policy: for
 * every scored named system, each readiness-group key is also covered by at
 * least one contribution group of the same system.
 *
 * The groups are read from the Registry v2 runtime accessors, because those are
 * what the policy actually consumes. They are derived from reviewed assessment
 * bindings, not from the static `SCORE_REQUIRED_GROUPS` and
 * `SCORE_CONTRIBUTION_GROUPS` tables in the catalog module, which mirror the
 * derived data but are read by nothing in the scoring path.
 *
 * The policy resolves a readiness group and a contribution group through the
 * same usable-marker predicate, so full readiness coverage guarantees at least
 * one contribution resolves. Without coverage a system would report
 * `scoreable` with a null `state_score` and a `score_not_available` exclusion,
 * which no other suite would catch.
 *
 * The same assertion runs against a deliberately violating copy of the input,
 * so a check that could never fail is itself a failure.
 */

import assert from "node:assert/strict";
import {
  getRegistryV2ScoreContributionGroups,
  getRegistryV2ScoreReadinessGroups,
  NAMED_BODY_SYSTEMS,
  NON_SCOREABLE_SYSTEMS,
} from "../src/lib/biomarkers/registry-v2-runtime";
import type {
  NamedBodySystemId,
  ScoreContributionGroup,
  ScoreRequiredGroup,
} from "../src/lib/biomarkers";

export type SystemScoreGroups = {
  readiness: readonly ScoreRequiredGroup[];
  contribution: readonly ScoreContributionGroup[];
};

export type UncoveredReadinessKey = {
  system: NamedBodySystemId;
  keys: string[];
};

export type CoverageReport = {
  covered: {
    system: NamedBodySystemId;
    readiness_groups: number;
    contribution_groups: number;
  }[];
  exempt: NamedBodySystemId[];
  uncovered: UncoveredReadinessKey[];
};

/**
 * A system is exempt when it is declared non-scoreable or when it declares no
 * readiness group to cover. Both are product decisions, so they are reported
 * rather than passed over.
 */
export function reportReadinessContributionCoverage(
  groupsFor: (system: NamedBodySystemId) => SystemScoreGroups,
  nonScoreableSystems: ReadonlySet<NamedBodySystemId>,
): CoverageReport {
  const covered: CoverageReport["covered"] = [];
  const exempt: NamedBodySystemId[] = [];
  const uncovered: UncoveredReadinessKey[] = [];

  for (const system of NAMED_BODY_SYSTEMS) {
    const { readiness, contribution } = groupsFor(system);
    if (nonScoreableSystems.has(system) || readiness.length === 0) {
      exempt.push(system);
      continue;
    }

    covered.push({
      system,
      readiness_groups: readiness.length,
      contribution_groups: contribution.length,
    });

    const coveredKeys = new Set(contribution.flatMap((group) => group.keys));
    const gaps = readiness.flat().filter((key) => !coveredKeys.has(key));
    if (gaps.length > 0) uncovered.push({ system, keys: gaps });
  }

  return { covered, exempt, uncovered };
}

export function formatUncovered(
  uncovered: readonly UncoveredReadinessKey[],
): string[] {
  return uncovered.flatMap(({ system, keys }) =>
    keys.map(
      (key) => `${system}: readiness key "${key}" has no contribution group`,
    ),
  );
}

const runtimeGroups = (system: NamedBodySystemId): SystemScoreGroups => ({
  readiness: getRegistryV2ScoreReadinessGroups(system),
  contribution: getRegistryV2ScoreContributionGroups(system),
});

const shipped = reportReadinessContributionCoverage(
  runtimeGroups,
  NON_SCOREABLE_SYSTEMS,
);

for (const entry of shipped.covered) {
  console.log(
    `[covered] ${entry.system} | readiness groups: ${entry.readiness_groups} | contribution groups: ${entry.contribution_groups}`,
  );
}
for (const system of shipped.exempt) {
  const reason = NON_SCOREABLE_SYSTEMS.has(system)
    ? "declared non_scoreable"
    : "declares no readiness group";
  console.log(`[exempt]  ${system} | ${reason}, no coverage required`);
}
for (const line of formatUncovered(shipped.uncovered)) {
  console.error(`[uncovered] ${line}`);
}

if (shipped.uncovered.length > 0) {
  process.exitCode = 1;
  throw new Error(
    `readiness/contribution coverage violated: ${formatUncovered(shipped.uncovered).join("; ")}`,
  );
}

const violations = reportReadinessContributionCoverage(
  (system) =>
    system === "thyroid"
      ? { readiness: runtimeGroups(system).readiness, contribution: [] }
      : runtimeGroups(system),
  NON_SCOREABLE_SYSTEMS,
);

assert.equal(
  violations.uncovered.length,
  1,
  "a readiness key with no contribution group must be reported, otherwise this check cannot fail",
);
assert.equal(violations.uncovered[0]?.system, "thyroid");

const messages = formatUncovered(violations.uncovered);
assert.ok(
  messages.some((line) => line.includes("thyroid") && line.includes("tsh")),
  `the violation must name the system and the key, got: ${messages.join("; ")}`,
);
assert.ok(
  messages.some((line) => line.includes("free_t4")),
  `every uncovered key must be reported, got: ${messages.join("; ")}`,
);

console.log("verify-score-readiness-contribution-invariant: all checks passed");
