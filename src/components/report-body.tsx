import {
  doctorVisitBriefSchema,
  type DoctorVisitBrief,
  type ReportSectionId,
  type ReportSource,
} from "@/lib/report-contract";

export type LegacyReportContent = {
  overview?: unknown;
  key_findings?: unknown;
  changes?: unknown;
  questions_for_clinician?: unknown;
  disclaimer?: unknown;
};

export type ReportContent = DoctorVisitBrief | LegacyReportContent;

const SECTION_TITLES: Record<ReportSectionId, string> = {
  document_summary: "Document summary",
  latest_measurements: "Latest measurements",
  changes: "Changes over time",
  clinician_questions: "Questions for your clinician",
  limitations: "Limitations",
  source_ledger: "Source ledger",
};

function isStructuredBrief(
  content: ReportContent,
): content is DoctorVisitBrief {
  return doctorVisitBriefSchema.safeParse(content).success;
}

function emptyStateLabel(value: string | undefined): string {
  if (value === "not_applicable") return "Not applicable for this report.";
  if (value === "insufficient_evidence") {
    return "Insufficient source evidence for this section.";
  }
  return "No source-backed entries were available for this section.";
}

function sourceLabel(source: ReportSource): string {
  const snapshot = source.snapshot;
  const reference = `Source ${source.source_id}`;
  if (snapshot.kind === "observation") {
    const value =
      snapshot.value_text?.trim() ||
      (snapshot.value === null ? "" : String(snapshot.value));
    const unit = snapshot.unit.trim();
    return `${reference}: ${value ? `${value}${unit ? ` ${unit}` : ""}` : "value unavailable"}`;
  }
  if (snapshot.kind === "document_summary") {
    return `${reference}: ${snapshot.document_type}`;
  }
  return reference;
}

function citationLabels(
  claim: DoctorVisitBrief["claims"][number],
  sources: Map<string, ReportSource>,
): string[] {
  return claim.citations.flatMap((citation) => {
    const source = sources.get(citation.source_id);
    return source ? [sourceLabel(source)] : [];
  });
}

function StructuredReportBody({ brief }: { brief: DoctorVisitBrief }) {
  const claims = new Map(brief.claims.map((claim) => [claim.id, claim]));
  const sources = new Map(
    brief.sources.map((source) => [source.source_id, source]),
  );
  const limitations = new Map(
    brief.limitations.map((limitation) => [limitation.id, limitation]),
  );

  return (
    <article className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <p className="text-xs text-[var(--eh-text-muted)]">
        Generated {new Date(brief.generated_at).toLocaleString("en-US")}
      </p>
      <section>
        <h2 className="font-semibold">Overview</h2>
        <p className="mt-2 text-sm">{brief.overview}</p>
      </section>
      {brief.sections.map((section) => (
        <section key={section.id}>
          <h2 className="font-semibold">{SECTION_TITLES[section.id]}</h2>
          {section.items.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--eh-text-muted)]">
              {emptyStateLabel(section.empty_state)}
            </p>
          ) : (
            <ul className="mt-2 space-y-3 text-sm">
              {section.items.map((item, index) => {
                if (item.type === "claim_ref") {
                  const claim = claims.get(item.claim_id);
                  if (!claim) return null;
                  const citations = citationLabels(claim, sources);
                  return (
                    <li key={`${section.id}-${item.claim_id}-${index}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        {claim.kind === "clinician_question" ? (
                          <>
                            <span className="font-medium">
                              {claim.question_text}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                              {claim.origin === "user_selected"
                                ? "Selected by you"
                                : "Generated"}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>{claim.text}</span>
                            {claim.status === "limited" && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                                Limited evidence
                              </span>
                            )}
                          </>
                        )}
                      </div>
                      {citations.length > 0 && (
                        <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
                          Sources: {citations.join("; ")}
                        </p>
                      )}
                    </li>
                  );
                }
                if (item.type === "limitation_ref") {
                  const limitation = limitations.get(item.limitation_id);
                  return limitation ? (
                    <li key={`${section.id}-${item.limitation_id}-${index}`}>
                      <span>{limitation.message}</span>
                    </li>
                  ) : null;
                }
                const source = sources.get(item.source_id);
                return source ? (
                  <li key={`${section.id}-${item.source_id}-${index}`}>
                    <span>{sourceLabel(source)}</span>
                    {source.snapshot.observed_at && (
                      <span className="ml-2 text-xs text-[var(--eh-text-muted)]">
                        {new Date(
                          source.snapshot.observed_at,
                        ).toLocaleDateString("en-US")}
                      </span>
                    )}
                  </li>
                ) : null;
              })}
            </ul>
          )}
        </section>
      ))}
      {brief.validation.status === "limited" && (
        <p className="border-t pt-4 text-xs text-amber-900">
          Some items are limited or omitted because source evidence or
          validation requirements were not satisfied.
        </p>
      )}
      <p className="border-t pt-4 text-xs font-medium text-amber-800">
        {brief.disclaimer}
      </p>
    </article>
  );
}

function legacyItems(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function LegacyReportBody({ content }: { content: LegacyReportContent }) {
  const sections = [
    [
      "Overview",
      typeof content.overview === "string" ? [content.overview] : [],
    ],
    ["Key findings", legacyItems(content.key_findings)],
    ["Changes over time", legacyItems(content.changes)],
    [
      "Questions for your clinician",
      legacyItems(content.questions_for_clinician),
    ],
  ] as const;
  return (
    <article className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        This report uses the legacy format. It remains readable, but
        source-grounded sharing and export are unavailable until it is
        regenerated.
      </p>
      {sections.map(([title, items]) => (
        <section key={title}>
          <h2 className="font-semibold">{title}</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--eh-text-muted)]">
              No entries were stored for this section.
            </p>
          ) : (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {items.map((item, index) => (
                <li key={`${title}-${index}`}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="border-t pt-4 text-xs font-medium text-amber-800">
        {typeof content.disclaimer === "string"
          ? content.disclaimer
          : "Educational information only. Discuss this report with a qualified healthcare professional."}
      </p>
    </article>
  );
}

export function ReportBody({ content }: { content: ReportContent }) {
  return isStructuredBrief(content) ? (
    <StructuredReportBody brief={content} />
  ) : (
    <LegacyReportBody content={content} />
  );
}
