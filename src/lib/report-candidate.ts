import { z } from "zod";
import type { ReportEvidenceProjection } from "@/lib/report-evidence";
import {
  REPORT_SECTION_IDS,
  type ReportDetailLevel,
  type ReportSectionId,
  type ReportSource,
} from "@/lib/report-contract";
import { CURRENT_REPORT_SCHEMA_VERSION } from "@/lib/report-citation-validator";

const FACTUAL_SECTIONS = [
  "document_summary",
  "latest_measurements",
  "changes",
] as const;

const selectionClaimSchema = z.object({
  section: z.enum(FACTUAL_SECTIONS),
  kind: z.enum(["source_fact", "numeric_observation"]),
  source_id: z.string(),
  include_date: z.boolean().optional(),
  include_range: z.boolean().optional(),
});

export type ReportSelection = {
  claims: z.infer<typeof selectionClaimSchema>[];
  questions: string[];
};

/**
 * Parse the model selection item by item. One malformed entry must not discard
 * an otherwise usable selection; unparsable entries simply render nothing.
 */
export function parseReportSelection(raw: unknown): ReportSelection {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { claims: [], questions: [] };
  }
  const record = raw as Record<string, unknown>;
  return {
    claims: z.array(selectionClaimSchema).safeParse(record.claims).data ?? [],
    questions: z.array(z.string()).safeParse(record.questions).data ?? [],
  };
}

export class UnknownSelectedSourceError extends Error {
  constructor(readonly sourceId: string) {
    super("REPORT_SELECTION_UNKNOWN_SOURCE");
    this.name = "UnknownSelectedSourceError";
  }
}
/**
 * Coverage the brief owes the reader regardless of what the model chose: the
 * latest measurement of every marker, every observation of a marker that has
 * dated history worth comparing, and a document-summary item for each remaining
 * catalog source. The model can add to this, never remove it.
 */
function coverageClaims(
  sources: readonly ReportSource[],
): ReportSelection["claims"] {
  const markers = new Map<string, ReportSource[]>();
  for (const source of sources) {
    if (
      source.kind !== "observation" ||
      source.snapshot.kind !== "observation"
    ) {
      continue;
    }
    const key = `${source.snapshot.label}::${source.snapshot.unit}`;
    markers.set(key, [...(markers.get(key) ?? []), source]);
  }

  const claims: ReportSelection["claims"] = [];
  const covered = new Set<string>();
  for (const group of markers.values()) {
    const dated = [...group].sort((left, right) => {
      const byDate = (left.snapshot.observed_at ?? "").localeCompare(
        right.snapshot.observed_at ?? "",
      );
      return byDate || left.source_id.localeCompare(right.source_id);
    });
    const latest = dated[dated.length - 1];
    if (!latest) continue;
    claims.push({
      section: "latest_measurements",
      kind: "numeric_observation",
      source_id: latest.source_id,
      include_range: true,
    });
    covered.add(latest.source_id);

    const distinctDates = new Set(
      dated.map((source) => source.snapshot.observed_at ?? null),
    );
    if (dated.length >= 2 && distinctDates.size >= 2) {
      for (const source of dated) {
        claims.push({
          section: "changes",
          kind: "numeric_observation",
          source_id: source.source_id,
          include_range: true,
        });
        covered.add(source.source_id);
      }
    }
  }

  for (const source of sources) {
    if (covered.has(source.source_id)) continue;
    claims.push({
      section: "document_summary",
      kind: "source_fact",
      source_id: source.source_id,
      include_date: true,
    });
  }
  return claims;
}

/**
 * Turn the model's selection into the exact validator candidate envelope.
 *
 * The model may only choose which closed-template claims to render and which
 * questions to ask. Every structural field the validator and the RPC check is
 * built here, so a malformed or hostile selection can drop an item but can
 * never introduce text, identifiers, or reference shapes the contract forbids.
 */
export function assembleReportCandidate(options: {
  selection: ReportSelection;
  projection: ReportEvidenceProjection;
  detailLevel: ReportDetailLevel;
  generatedAt: string;
}): Record<string, unknown> {
  const sourceById = new Map(
    options.projection.sources.map((source) => [source.source_id, source]),
  );

  const claims: Array<Record<string, unknown>> = [];
  const claimIdsBySection = new Map<ReportSectionId, string[]>();
  const addClaimToSection = (
    section: ReportSectionId,
    claim: Record<string, unknown>,
  ) => {
    claims.push(claim);
    claimIdsBySection.set(section, [
      ...(claimIdsBySection.get(section) ?? []),
      String(claim.id),
    ]);
  };

  const seenClaims = new Set<string>();
  const modelClaims = options.selection.claims;
  for (const claim of modelClaims) {
    if (!sourceById.has(claim.source_id)) {
      // The selection asked for evidence that does not exist in the
      // server-authorized catalog. There is no well-formed claim to hand to
      // EH-150, so the whole candidate fails closed: nothing is rendered and
      // nothing is persisted.
      throw new UnknownSelectedSourceError(claim.source_id);
    }
  }

  const selectedClaims = [
    ...modelClaims,
    ...coverageClaims(options.projection.sources),
  ];
  for (const claim of selectedClaims) {
    const source = sourceById.get(claim.source_id);
    if (!source) continue;
    if (claim.kind === "numeric_observation" && source.kind !== "observation") {
      continue;
    }
    const key = `${claim.section}|${claim.kind}|${source.source_id}`;
    if (seenClaims.has(key)) continue;
    seenClaims.add(key);

    addClaimToSection(claim.section, {
      id: `claim-${claims.length + 1}`,
      section: claim.section,
      kind: claim.kind,
      origin: "generated",
      factual: true,
      status: "supported",
      template_id:
        claim.kind === "numeric_observation"
          ? "numeric_observation_snapshot"
          : "source_fact_snapshot",
      template_params:
        claim.kind === "numeric_observation"
          ? {
              source_id: source.source_id,
              include_range: claim.include_range !== false,
            }
          : {
              source_id: source.source_id,
              include_date: claim.include_date !== false,
            },
      citations: [
        { source_id: source.source_id, document_id: source.document_id },
      ],
    });
  }

  const seenQuestions = new Set<string>();
  for (const rawQuestion of options.selection.questions) {
    const question = rawQuestion.normalize("NFC").trim();
    if (
      !question.endsWith("?") ||
      [...question].length > 240 ||
      seenQuestions.has(question)
    ) {
      continue;
    }
    seenQuestions.add(question);
    addClaimToSection("clinician_questions", {
      id: `claim-${claims.length + 1}`,
      section: "clinician_questions",
      kind: "clinician_question",
      origin: "generated",
      factual: false,
      status: "supported",
      question_text: question,
      citations: [],
    });
  }

  const sections = REPORT_SECTION_IDS.map((id) => {
    if (id === "source_ledger") {
      return {
        id,
        items: options.projection.sources.map((source: ReportSource) => ({
          type: "source_ref",
          source_id: source.source_id,
        })),
      };
    }
    if (id === "limitations") {
      return { id, items: [], empty_state: "no_data" };
    }
    const claimIds = claimIdsBySection.get(id) ?? [];
    return claimIds.length > 0
      ? {
          id,
          items: claimIds.map((claimId) => ({
            type: "claim_ref",
            claim_id: claimId,
          })),
        }
      : { id, items: [], empty_state: "insufficient_evidence" };
  });

  return {
    schema_version: CURRENT_REPORT_SCHEMA_VERSION,
    report_kind: "doctor_visit_brief",
    generated_at: options.generatedAt,
    detail_level: options.detailLevel,
    source_document_ids: [...options.projection.source_document_ids],
    sections,
    claims,
    sources: options.projection.sources.map((source: ReportSource) => ({
      source_id: source.source_id,
      kind: source.kind,
      document_id: source.document_id,
    })),
    limitations: [],
  };
}
