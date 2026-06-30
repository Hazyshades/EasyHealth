import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

export function DocumentSummaryCard({ summary }: { summary: string | null }) {
  if (!summary) return null;
  return (
    <div className="mb-4 rounded-xl border border-teal-100 bg-teal-50/60 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-800">Summary</p>
      <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">{summary}</p>
    </div>
  );
}

type InstrumentalFinding = {
  id: string;
  modality: string | null;
  body_region: string | null;
  finding_text: string;
  impression: string | null;
  source_page: number | null;
};

export function InstrumentalInsightsPanel({
  findings,
  summary,
  modality,
  processingStatus,
  onSelectSource,
}: {
  findings: InstrumentalFinding[];
  summary: string | null;
  modality: string | null;
  processingStatus: string;
  onSelectSource: (page: number | null, text: string | null) => void;
}) {
  const impression = findings.find((f) => f.impression)?.impression ?? null;
  const bodyRegion = findings.find((f) => f.body_region)?.body_region ?? null;

  return (
    <>
      <DocumentSummaryCard summary={summary} />
      {modality || bodyRegion ? (
        <p className="mb-3 text-sm text-[var(--eh-text-secondary)]">
          {[modality, bodyRegion].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {findings.length > 0 ? (
        <ul className="max-h-[420px] space-y-2 overflow-y-auto">
          {findings.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-[var(--eh-brand)]"
                onClick={() => onSelectSource(f.source_page, f.finding_text)}
              >
                <p className="text-sm text-[var(--eh-text-primary)]">{f.finding_text}</p>
                {f.source_page ? (
                  <p className="mt-1 text-xs text-[var(--eh-text-muted)]">Page {f.source_page}</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--eh-text-secondary)]">
          {processingStatus === "processing"
            ? "Extraction in progress…"
            : "No structured findings detected in this report."}
        </p>
      )}
      {impression ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs font-medium text-[var(--eh-text-muted)]">Impression (from document)</p>
          <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">{impression}</p>
        </div>
      ) : null}
    </>
  );
}

type ClinicalNote = {
  provider_name: string | null;
  visit_date: string | null;
  chief_complaint: string | null;
  history_summary: string | null;
  exam_findings: string | null;
  documented_diagnoses: string[] | null;
  recommendations: string[] | null;
  follow_up_plan: string | null;
};

function Section({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-[var(--eh-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">{value}</p>
    </div>
  );
}

function ListSection({ label, items }: { label: string; items: string[] | null | undefined }) {
  const list = items?.filter(Boolean) ?? [];
  if (list.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-[var(--eh-text-muted)]">{label}</p>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-[var(--eh-text-secondary)]">
        {list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ConsultationInsightsPanel({
  note,
  summary,
  processingStatus,
}: {
  note: ClinicalNote | null;
  summary: string | null;
  processingStatus: string;
}) {
  if (!note) {
    return (
      <p className="text-sm text-[var(--eh-text-secondary)]">
        {processingStatus === "processing"
          ? "Extraction in progress…"
          : "No structured consultation data detected."}
      </p>
    );
  }

  return (
    <>
      <DocumentSummaryCard summary={summary} />
      <div className="max-h-[480px] space-y-2 overflow-y-auto">
        <Section label="Provider" value={note.provider_name} />
        <Section label="Visit date" value={note.visit_date} />
        <Section label="Chief complaint" value={note.chief_complaint} />
        <Section label="History" value={note.history_summary} />
        <Section label="Exam findings" value={note.exam_findings} />
        <ListSection label="Documented diagnoses (from record)" items={note.documented_diagnoses} />
        <ListSection label="Recommendations" items={note.recommendations} />
        <Section label="Follow-up plan" value={note.follow_up_plan} />
      </div>
    </>
  );
}

export function PanelDisclaimer() {
  return <p className="mt-4 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>;
}
