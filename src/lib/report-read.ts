import {
  assertDoctorVisitBrief,
  REPORT_CONTRACT_VERSION,
  REPORT_VALIDATION_VERSION,
  type DoctorVisitBrief,
} from "@/lib/report-contract";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReportReadMode = "owner" | "share" | "export";

export type LegacyReportRead = {
  status: "legacy";
  can_share: false;
  can_export: false;
  report: {
    id: string;
    title: string;
    report_type: string;
    detail_level: string;
    abnormal_only: boolean;
    content: unknown;
    summary_preview: string;
    created_at: string;
  };
};

export type StructuredReportRead = {
  status: "structured";
  can_share: boolean;
  can_export: boolean;
  report: {
    id: string;
    title: string;
    report_type: string;
    detail_level: string;
    abnormal_only: boolean;
    content: DoctorVisitBrief;
    summary_preview: string;
    created_at: string;
  };
};

export type ReportReadUnavailable = {
  status: "unavailable";
  reason:
    | "not_found"
    | "invalidated"
    | "document_unavailable"
    | "validation_invalid"
    | "legacy_not_shareable"
    | "evidence_unavailable";
};

export type ReportReadResult =
  | LegacyReportRead
  | StructuredReportRead
  | ReportReadUnavailable;

type ReportRow = {
  id: string;
  title: string;
  report_type: string;
  detail_level: string;
  document_ids: string[] | null;
  requested_document_ids: string[] | null;
  requested_scope_kind: string | null;
  actual_source_document_ids: string[] | null;
  source_scope_known: boolean | null;
  validation_status: "valid" | "limited" | null;
  validation_version: string | null;
  validation_issue_codes: string[] | null;
  abnormal_only: boolean;
  summary_preview: string;
  created_at: string;
  invalidated_at: string | null;
  content: unknown;
};

type MappingRow = {
  source_id: string;
  source_kind: string;
  source_row_id: string;
  document_id: string;
};

function readField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function isMappingRow(value: unknown): value is MappingRow {
  return (
    typeof readField(value, "source_id") === "string" &&
    typeof readField(value, "source_kind") === "string" &&
    typeof readField(value, "source_row_id") === "string" &&
    typeof readField(value, "document_id") === "string"
  );
}

function isStructuredReport(row: ReportRow): boolean {
  const contentSchemaVersion = readField(row.content, "schema_version");
  return (
    row.validation_version !== null ||
    contentSchemaVersion === REPORT_CONTRACT_VERSION
  );
}

function unavailableForMode(
  _mode: ReportReadMode,
  reason: ReportReadUnavailable["reason"],
): ReportReadUnavailable {
  return { status: "unavailable", reason };
}
async function findUnavailableSourceIds(
  mappings: MappingRow[],
  profileId: string,
): Promise<Set<string>> {
  const supabase = createAdminClient();
  const unavailable = new Set<string>();
  const groups = new Map<string, MappingRow[]>();
  for (const mapping of mappings) {
    const group = groups.get(mapping.source_kind) ?? [];
    group.push(mapping);
    groups.set(mapping.source_kind, group);
  }

  const sourceTables = [
    ["observation", "observations", "id", "id, document_id, profile_id"],
    [
      "finding",
      "document_extracted_findings",
      "id",
      "id, document_id, profile_id, status",
    ],
    [
      "clinical_note",
      "document_extracted_clinical_notes",
      "id",
      "id, document_id, profile_id, status, is_published",
    ],
    [
      "prescription",
      "document_extracted_prescriptions",
      "id",
      "id, document_id, profile_id, status, is_published",
    ],
    [
      "referral",
      "document_extracted_referrals",
      "id",
      "id, document_id, profile_id, status, is_published",
    ],
  ] as const;
  const queries = await Promise.all(
    sourceTables.map(async ([kind, table, column, selection]) => {
      const sourceMappings = groups.get(kind) ?? [];
      if (sourceMappings.length === 0) return { kind, rows: [], error: null };
      const { data, error } = await supabase
        .from(table)
        .select(selection)
        .eq("profile_id", profileId)
        .in(
          column,
          sourceMappings.map((mapping) => mapping.source_row_id),
        );
      return { kind, rows: data ?? [], error };
    }),
  );

  for (const result of queries) {
    const sourceMappings = groups.get(result.kind) ?? [];
    const mappingsByRowId = new Map(
      sourceMappings.map((mapping) => [mapping.source_row_id, mapping]),
    );
    if (result.error) {
      for (const mapping of sourceMappings) unavailable.add(mapping.source_id);
      continue;
    }
    const availableIds = new Set(
      result.rows
        .filter((row) => {
          const status = readField(row, "status");
          const published = readField(row, "is_published");
          const mapping = mappingsByRowId.get(String(readField(row, "id")));
          return (
            mapping !== undefined &&
            readField(row, "document_id") === mapping.document_id &&
            readField(row, "profile_id") === profileId &&
            (status === undefined ||
              status === "accepted" ||
              status === "auto_accepted") &&
            (published === undefined || published === true)
          );
        })
        .map((row) => readField(row, "id"))
        .filter((id): id is string => typeof id === "string"),
    );
    for (const mapping of sourceMappings) {
      if (!availableIds.has(mapping.source_row_id)) {
        unavailable.add(mapping.source_id);
      }
    }
  }

  return unavailable;
}

function applyUnavailableSources(
  brief: DoctorVisitBrief,
  unavailableSourceIds: Set<string>,
): DoctorVisitBrief {
  if (unavailableSourceIds.size === 0) return brief;
  const next = structuredClone(brief);
  const limitedClaimIds = new Set(
    next.claims
      .filter(
        (claim) =>
          claim.kind !== "clinician_question" &&
          claim.citations.some((citation) =>
            unavailableSourceIds.has(citation.source_id),
          ),
      )
      .map((claim) => claim.id),
  );
  next.claims = next.claims.map((claim) =>
    limitedClaimIds.has(claim.id)
      ? { ...claim, status: "limited" as const }
      : claim,
  );

  const limitationId = "resolver-source-unavailable";
  if (!next.limitations.some((limitation) => limitation.id === limitationId)) {
    next.limitations = [
      ...next.limitations,
      {
        id: limitationId,
        code: "SOURCE_UNAVAILABLE",
        message:
          "A source row is no longer available; its retained snapshot is shown as limited evidence.",
      },
    ];
  }
  next.sections = next.sections.map((section) => {
    if (section.id !== "limitations") return section;
    const items = section.items.some(
      (item) =>
        item.type === "limitation_ref" && item.limitation_id === limitationId,
    )
      ? section.items
      : [
          ...section.items,
          { type: "limitation_ref" as const, limitation_id: limitationId },
        ];
    return { ...section, items, empty_state: undefined };
  });
  next.validation = {
    ...next.validation,
    status: "limited",
    issue_codes: next.validation.issue_codes.includes("SOURCE_UNAVAILABLE")
      ? next.validation.issue_codes
      : [...next.validation.issue_codes, "SOURCE_UNAVAILABLE"],
  };
  return assertDoctorVisitBrief(next);
}

export async function resolveReportRead(options: {
  profileId: string;
  reportId: string;
  mode?: ReportReadMode;
}): Promise<ReportReadResult> {
  const mode = options.mode ?? "owner";
  const supabase = createAdminClient();
  const readSnapshot = async () => {
    const { data, error } = await supabase
      .rpc("read_report_snapshot", {
        p_profile_id: options.profileId,
        p_report_id: options.reportId,
      })
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  };
  const snapshot = await readSnapshot();

  const snapshotStatus = readField(snapshot, "status");
  if (snapshotStatus === "not_found") {
    return { status: "unavailable", reason: "not_found" };
  }
  if (snapshotStatus === "invalidated") {
    return unavailableForMode(mode, "invalidated");
  }
  if (snapshotStatus === "document_unavailable") {
    return unavailableForMode(mode, "document_unavailable");
  }
  if (snapshotStatus !== "available") {
    return unavailableForMode(mode, "validation_invalid");
  }

  const snapshotReport = readField(snapshot, "report");
  if (typeof snapshotReport !== "object" || snapshotReport === null) {
    return unavailableForMode(mode, "validation_invalid");
  }
  const row = snapshotReport as ReportRow;
  const confirmSnapshot = async (): Promise<ReportReadUnavailable | null> => {
    const confirmedSnapshot = await readSnapshot();
    const confirmedStatus = readField(confirmedSnapshot, "status");
    if (confirmedStatus === "not_found") {
      return unavailableForMode(mode, "not_found");
    }
    if (confirmedStatus === "invalidated") {
      return unavailableForMode(mode, "invalidated");
    }
    if (confirmedStatus === "document_unavailable") {
      return unavailableForMode(mode, "document_unavailable");
    }
    if (confirmedStatus !== "available") {
      return unavailableForMode(mode, "validation_invalid");
    }
    return null;
  };

  if (row.invalidated_at) {
    return unavailableForMode(mode, "invalidated");
  }

  if (isStructuredReport(row)) {
    if (
      row.source_scope_known !== true ||
      !Array.isArray(row.actual_source_document_ids) ||
      row.actual_source_document_ids.length === 0 ||
      (row.validation_status !== "valid" &&
        row.validation_status !== "limited") ||
      row.validation_version !== REPORT_VALIDATION_VERSION ||
      !Array.isArray(row.validation_issue_codes)
    ) {
      return unavailableForMode(mode, "validation_invalid");
    }

    let brief: DoctorVisitBrief;
    try {
      brief = assertDoctorVisitBrief(row.content);
    } catch {
      return unavailableForMode(mode, "validation_invalid");
    }
    if (
      brief.validation.status !== row.validation_status ||
      brief.validation.version !== row.validation_version ||
      JSON.stringify(brief.validation.issue_codes) !==
        JSON.stringify(row.validation_issue_codes)
    ) {
      return unavailableForMode(mode, "validation_invalid");
    }

    const { data: mappingRows, error: mappingError } = await supabase
      .from("report_evidence_sources")
      .select("source_id, source_kind, source_row_id, document_id")
      .eq("report_id", options.reportId);
    if (mappingError) {
      return unavailableForMode(mode, "evidence_unavailable");
    }
    const mappings = (mappingRows ?? []).filter(isMappingRow);
    const mappedSourceIds = new Set(
      mappings.map((mapping) => mapping.source_id),
    );
    const sourceById = new Map(
      brief.sources.map((source) => [source.source_id, source]),
    );
    if (
      mappings.length !== brief.sources.length ||
      mappedSourceIds.size !== brief.sources.length ||
      brief.sources.some((source) => !mappedSourceIds.has(source.source_id)) ||
      mappings.some((mapping) => {
        const source = sourceById.get(mapping.source_id);
        return (
          !source ||
          source.kind !== mapping.source_kind ||
          source.document_id !== mapping.document_id
        );
      })
    ) {
      return unavailableForMode(mode, "evidence_unavailable");
    }
    const unavailableSourceIds = await findUnavailableSourceIds(
      mappings,
      options.profileId,
    );
    const resolvedBrief = applyUnavailableSources(brief, unavailableSourceIds);
    const confirmation = await confirmSnapshot();
    if (confirmation) return confirmation;

    return {
      status: "structured",
      can_share: true,
      can_export: true,
      report: {
        id: row.id,
        title: row.title,
        report_type: row.report_type,
        detail_level: row.detail_level,
        abnormal_only: row.abnormal_only,
        content: resolvedBrief,
        summary_preview: row.summary_preview,
        created_at: row.created_at,
      },
    };
  }

  const confirmation = await confirmSnapshot();
  if (confirmation) return confirmation;

  if (mode !== "owner") {
    return unavailableForMode(mode, "legacy_not_shareable");
  }
  return {
    status: "legacy",
    can_share: false,
    can_export: false,
    report: {
      id: row.id,
      title: row.title,
      report_type: row.report_type,
      detail_level: row.detail_level,
      abnormal_only: row.abnormal_only,
      content: row.content,
      summary_preview: row.summary_preview,
      created_at: row.created_at,
    },
  };
}
