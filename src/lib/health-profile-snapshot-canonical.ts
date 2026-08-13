import { createHash } from "node:crypto";

export type SnapshotSourceRow = Readonly<{
  id: string;
  observed_at: string | null;
}>;

/** Orders timestamp ties by immutable ID so semantically identical reads hash identically. */
export function compareSnapshotRows(
  left: SnapshotSourceRow,
  right: SnapshotSourceRow,
): number {
  return `${left.observed_at ?? ""}:${left.id}`.localeCompare(
    `${right.observed_at ?? ""}:${right.id}`,
  );
}

/** Stable JSON hash shared by queued and request-time assessment projections. */
export function hashHealthProfileSnapshotInput(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}