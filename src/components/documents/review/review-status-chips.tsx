import { StatusChip } from "@/components/ui/status-chip";
import {
  resolverOutcomeVariant,
  verificationStatusVariant,
  type ReviewRowMappingState,
} from "@/lib/documents/observation-review-workspace";

/**
 * EH-117: resolution and verification are two independent axes and are always
 * presented together so a reviewer never reads "resolved" as "verified".
 */
export function ReviewStateChips({
  mapping,
}: {
  mapping: ReviewRowMappingState;
}) {
  if (!mapping.outcome || !mapping.label) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <StatusChip variant={resolverOutcomeVariant(mapping.outcome)}>
        {mapping.label}
      </StatusChip>
      <StatusChip variant={verificationStatusVariant(mapping.verificationStatus)}>
        {mapping.verificationLabel}
      </StatusChip>
      {mapping.confidenceBand ? (
        <span className="text-xs text-[var(--eh-text-muted)]">
          {mapping.confidenceBand} mapping confidence
        </span>
      ) : null}
    </div>
  );
}
