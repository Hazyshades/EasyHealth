/**
 * Enforces the catalog precondition behind the score/readiness policy: for
 * every scored named system, each readiness-group key is also covered by at
 * least one contribution group of the same system.
 *
 * The policy resolves a readiness group and a contribution group through the
 * same usable-marker predicate, so full readiness coverage guarantees at least
 * one contribution resolves. Without coverage a system would report
 * `scoreable` with a null `state_score` and a `score_not_available` exclusion,
 * which no other suite would catch.
 *
 * The same assertion runs against a deliberately violating copy of the tables,
 * so a check that could never fail is itself a failure.
 */

import assert from "node:assert/strict";
import {
  NAMED_BODY_SYSTEMS,
  NON_SCOREABLE_SYSTEMS,
  SCORE_CONTRIBUTION_GROUPS,
  SCORE_REQUIRED_GROUPS,
} from "../src/lib/biomarkers/catalog/index";
import type {
  NamedBodySystemId,
  ScoreContributionGroup,
  ScoreRequiredGroup,
} from "../src/lib/biomarkers";

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
  requiredGroups: Readonly<
    Record<NamedBodySystemId, readonly ScoreRequiredGroup[]>
  >,
  contributionGroups: Readonly<
    Record<NamedBodySystemId, readonly ScoreContributionGroup[]>
  >,
  nonScoreableSystems: ReadonlySet<NamedBodySystemId>,
): CoverageReport {
  const covered: CoverageReport["covered"] = [];
  const exempt: NamedBodySystemId[] = [];
  const uncovered: UncoveredReadinessKey[] = [];

  for (const system of NAMED_BODY_SYSTEMS) {
    const readiness = requiredGroups[system] ?? [];
    if (nonScoreableSystems.has(system) || readiness.length === 0) {
      exempt.push(system);
      continue;
    }

    covered.push({
      system,
      readiness_groups: readiness.length,
      contribution_groups: contributionGroups[system]?.length ?? 0,
    });

    const coveredKeys = new Set(
      (contributionGroups[system] ?? []).flatMap((group) => group.keys),
    );
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

const shipped = reportReadinessContributionCoverage(
  SCORE_REQUIRED_GROUPS,
  SCORE_CONTRIBUTION_GROUPS,
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

const violatedContributionGroups: Record<
  NamedBodySystemId,
  readonly ScoreContributionGroup[]
> = {
  ...SCORE_CONTRIBUTION_GROUPS,
  thyroid: SCORE_CONTRIBUTION_GROUPS.thyroid.map((group) => ({
    ...group,
    keys: [] as readonly string[],
  })),
};

const violated = reportReadinessContributionCoverage(
  SCORE_REQUIRED_GROUPS,
  violatedContributionGroups,
  NON_SCOREABLE_SYSTEMS,
);

assert.equal(
  violated.uncovered.length,
  1,
  "a readiness key with no contribution group must be reported, otherwise this check cannot fail",
);
assert.equal(violated.uncovered[0]?.system, "thyroid");

const violations = formatUncovered(violated.uncovered);
assert.ok(
  violations.some((line) => line.includes("thyroid") && line.includes("tsh")),
  `the violation must name the system and the key, got: ${violations.join("; ")}`,
);
assert.ok(
  violations.some((line) => line.includes("free_t4")),
  `every uncovered key must be reported, got: ${violations.join("; ")}`,
);

console.log("verify-score-readiness-contribution-invariant: all checks passed");
