/**
 * Versioned per-definition/display-unit tolerance policy for EH-149.
 *
 * Each reviewed entry supplies `{ absolute, relative }`, where `absolute`
 * is in the display unit and `relative` is dimensionless. Values are numeric
 * movement thresholds only — not clinical interpretation.
 */

export const DIRECTION_POLICY_VERSION = "1";

export type DirectionTolerance = {
  absolute: number;
  relative: number;
};

export type DirectionPolicyEntry = {
  measurementDefinitionKey: string;
  displayUnit: string;
  tolerance: DirectionTolerance;
};

const directionPolicyByEntry: Record<string, DirectionTolerance> = {};

export function setDirectionTolerance(
  measurementDefinitionKey: string,
  displayUnit: string,
  tolerance: DirectionTolerance,
): void {
  directionPolicyByEntry[
    `${measurementDefinitionKey}::${normalizePolicyUnit(displayUnit)}`
  ] = tolerance;
}

export function clearDirectionTolerance(
  measurementDefinitionKey: string,
  displayUnit: string,
): void {
  delete directionPolicyByEntry[
    `${measurementDefinitionKey}::${normalizePolicyUnit(displayUnit)}`
  ];
}

export function clearAllDirectionTolerances(): void {
  for (const key of Object.keys(directionPolicyByEntry)) {
    delete directionPolicyByEntry[key];
  }
}

export function getDirectionTolerance(
  measurementDefinitionKey: string,
  displayUnit: string,
): DirectionTolerance | undefined {
  return directionPolicyByEntry[
    `${measurementDefinitionKey}::${normalizePolicyUnit(displayUnit)}`
  ];
}

export function hasDirectionTolerance(
  measurementDefinitionKey: string,
  displayUnit: string,
): boolean {
  return (
    `${measurementDefinitionKey}::${normalizePolicyUnit(displayUnit)}` in
    directionPolicyByEntry
  );
}

function normalizePolicyUnit(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/μ/g, "µ")
    .replace(/\s+/g, " ");
}

/** Compare immutable observation IDs using canonical UUID byte order when possible. */
export function compareCanonicalObservationId(left: string, right: string): number {
  const leftBytes = uuidToBytes(left);
  const rightBytes = uuidToBytes(right);
  if (leftBytes && rightBytes) {
    for (let i = 0; i < 16; i += 1) {
      if (leftBytes[i] !== rightBytes[i]) return leftBytes[i]! - rightBytes[i]!;
    }
    return 0;
  }
  return left.localeCompare(right);
}

function uuidToBytes(value: string): Uint8Array | null {
  const normalized = value.trim().toLowerCase();
  const match =
    /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/.exec(
      normalized,
    );
  if (!match) return null;
  const hex = `${match[1]}${match[2]}${match[3]}${match[4]}${match[5]}`;
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function computeDirection(
  measurementDefinitionKey: string,
  displayUnit: string,
  observedPoints: ReadonlyArray<{
    observedAt: string;
    observationId: string;
    displayValue: number;
  }>,
): {
  direction: "increasing" | "decreasing" | "stable" | "not_available";
  tolerance: DirectionTolerance | undefined;
} {
  // Fewer than two points: not_available before policy lookup.
  if (observedPoints.length < 2) {
    return { direction: "not_available", tolerance: undefined };
  }

  const sorted = [...observedPoints].sort((a, b) => {
    const byDate = a.observedAt.localeCompare(b.observedAt);
    return byDate !== 0
      ? byDate
      : compareCanonicalObservationId(a.observationId, b.observationId);
  });

  const first = sorted[0]!.displayValue;
  const latest = sorted[sorted.length - 1]!.displayValue;
  const delta = latest - first;
  const tolerance = getDirectionTolerance(measurementDefinitionKey, displayUnit);

  if (!tolerance) {
    return { direction: "not_available", tolerance: undefined };
  }

  const threshold = Math.max(
    tolerance.absolute,
    tolerance.relative * Math.abs(first),
  );

  if (Math.abs(delta) <= threshold) {
    return { direction: "stable", tolerance };
  }
  if (delta > threshold) {
    return { direction: "increasing", tolerance };
  }
  return { direction: "decreasing", tolerance };
}
