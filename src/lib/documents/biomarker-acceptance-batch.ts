export type BiomarkerAcceptanceFailure = {
  id: string;
  error: string;
};

type ExtractedBiomarkerAcceptanceRow = {
  id: string;
};

function failureMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Normalization writer failed";
}

/**
 * Apply a selected set of extracted rows independently. The injected writer
 * owns each row's database transaction; this loop only preserves partial
 * results so a stale or rejected row cannot suppress an eligible sibling.
 */
export async function acceptExtractedBiomarkerRows<Row extends ExtractedBiomarkerAcceptanceRow>(
  options: {
    ids: readonly string[];
    rows: readonly Row[];
    writeRow: (row: Row) => Promise<unknown>;
  }
): Promise<{ acceptedIds: string[]; failures: BiomarkerAcceptanceFailure[] }> {
  const ids = [...new Set(options.ids)];
  const rowsById = new Map(options.rows.map((row) => [row.id, row]));
  const acceptedIds: string[] = [];
  const failures: BiomarkerAcceptanceFailure[] = [];

  for (const id of ids) {
    const row = rowsById.get(id);
    if (!row) {
      failures.push({ id, error: "Extracted biomarker not found" });
      continue;
    }

    try {
      await options.writeRow(row);
      acceptedIds.push(row.id);
    } catch (error) {
      failures.push({ id: row.id, error: failureMessage(error) });
    }
  }

  return { acceptedIds, failures };
}
