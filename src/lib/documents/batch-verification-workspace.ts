export type BatchVerificationSelectionSummary = Readonly<{
  selectedCount: number;
  deselectedEligibleCount: number;
  excludedCount: number;
}>;

/**
 * Presentation-only selection counts for a server-projected eligible cohort.
 * This deliberately does not decide which rows are eligible.
 */
export function summarizeBatchVerificationSelection(options: {
  eligibleIds: readonly string[];
  selectedIds: ReadonlySet<string>;
  excludedCount: number;
}): BatchVerificationSelectionSummary {
  const eligibleIds = new Set(options.eligibleIds);
  let selectedCount = 0;
  for (const id of options.selectedIds) {
    if (eligibleIds.has(id)) selectedCount += 1;
  }

  return {
    selectedCount,
    deselectedEligibleCount: eligibleIds.size - selectedCount,
    excludedCount: options.excludedCount,
  };
}
