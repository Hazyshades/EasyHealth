import { createHash } from "node:crypto";

export type BatchVerificationSnapshot = Readonly<{
  extractedBiomarkerId: string;
  sourceSnapshot: string | null;
  activeRevisionId: string | null;
}>;

export type BatchVerificationOutcome = "verified" | "excluded" | "missing" | "failed";
export type BatchVerificationAggregateStatus =
  | "completed"
  | "partially_completed"
  | "no_op"
  | "failed";

export class BatchVerificationRequestError extends Error {}

export type PreparedBatchVerificationSnapshots = Readonly<{
  snapshots: readonly BatchVerificationSnapshot[];
  requestHash: string;
}>;

function requestHash(snapshots: readonly BatchVerificationSnapshot[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        snapshots.map(({ extractedBiomarkerId, sourceSnapshot, activeRevisionId }) => ({
          extractedBiomarkerId,
          sourceSnapshot,
          activeRevisionId,
        })),
      ),
    )
    .digest("hex");
}

export function prepareBatchVerificationSnapshots(
  snapshots: readonly BatchVerificationSnapshot[],
): PreparedBatchVerificationSnapshots {
  const byId = new Map<string, BatchVerificationSnapshot>();
  for (const snapshot of snapshots) {
    if (!snapshot.extractedBiomarkerId || byId.has(snapshot.extractedBiomarkerId)) {
      throw new BatchVerificationRequestError("Each batch result must be selected once");
    }
    byId.set(snapshot.extractedBiomarkerId, snapshot);
  }
  if (byId.size === 0) {
    throw new BatchVerificationRequestError("No batch results selected");
  }
  const canonical = [...byId.values()].sort((left, right) =>
    left.extractedBiomarkerId.localeCompare(right.extractedBiomarkerId),
  );
  return { snapshots: canonical, requestHash: requestHash(canonical) };
}

export function batchVerificationAggregateStatus(
  outcomes: readonly Readonly<{ outcome: BatchVerificationOutcome }>[],
): BatchVerificationAggregateStatus {
  const verified = outcomes.filter((outcome) => outcome.outcome === "verified").length;
  if (verified === outcomes.length && verified > 0) return "completed";
  if (verified > 0) return "partially_completed";
  if (outcomes.some((outcome) => outcome.outcome === "failed")) return "failed";
  return "no_op";
}
