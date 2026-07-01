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
  documented_problems: string[] | null;
  recommendations: string[] | null;
  follow_up_plan: string | null;
};

type DischargeNote = ClinicalNote & {
  admission_date?: string | null;
  discharge_date?: string | null;
  hospital_course?: string | null;
  discharge_diagnoses?: string[] | null;
  discharge_medications?: string[] | null;
  follow_up_instructions?: string | null;
};

type PrescriptionRow = {
  prescriber_name: string | null;
  prescribed_at: string | null;
  medications: Array<{
    name: string;
    dose?: string | null;
    frequency?: string | null;
    duration?: string | null;
    instructions?: string | null;
  }> | null;
};

type ReferralRow = {
  referring_provider: string | null;
  referred_to_specialty: string | null;
  referred_to_provider: string | null;
  referral_date: string | null;
  reason_for_referral: string | null;
  clinical_summary: string | null;
  urgency: string | null;
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
        <ListSection label="Problems noted in record (as written)" items={note.documented_problems} />
        <ListSection label="Recommendations" items={note.recommendations} />
        <Section label="Follow-up plan" value={note.follow_up_plan} />
      </div>
    </>
  );
}

export function PanelDisclaimer() {
  return <p className="mt-4 text-xs text-[var(--eh-text-muted)]">{MEDICAL_DISCLAIMER}</p>;
}

export function DischargeInsightsPanel({
  note,
  summary,
  processingStatus,
}: {
  note: DischargeNote | null;
  summary: string | null;
  processingStatus: string;
}) {
  if (!note) {
    return (
      <p className="text-sm text-[var(--eh-text-secondary)]">
        {processingStatus === "processing"
          ? "Extraction in progress…"
          : "No structured discharge data detected."}
      </p>
    );
  }

  return (
    <>
      <DocumentSummaryCard summary={summary} />
      <div className="max-h-[480px] space-y-2 overflow-y-auto">
        <Section label="Provider" value={note.provider_name} />
        <Section label="Admission date" value={note.admission_date} />
        <Section label="Discharge date" value={note.discharge_date} />
        <Section label="Hospital course" value={note.hospital_course} />
        <ListSection label="Discharge diagnoses" items={note.discharge_diagnoses} />
        <ListSection label="Discharge medications" items={note.discharge_medications} />
        <Section label="Follow-up instructions" value={note.follow_up_instructions} />
        <Section label="History" value={note.history_summary} />
        <Section label="Exam findings" value={note.exam_findings} />
        <ListSection label="Problems noted in record (as written)" items={note.documented_problems} />
        <ListSection label="Recommendations" items={note.recommendations} />
        <Section label="Follow-up plan" value={note.follow_up_plan} />
      </div>
    </>
  );
}

export function PrescriptionInsightsPanel({
  prescription,
  summary,
  processingStatus,
}: {
  prescription: PrescriptionRow | null;
  summary: string | null;
  processingStatus: string;
}) {
  if (!prescription) {
    return (
      <p className="text-sm text-[var(--eh-text-secondary)]">
        {processingStatus === "processing"
          ? "Extraction in progress…"
          : "No structured prescription data detected."}
      </p>
    );
  }

  const meds = prescription.medications ?? [];

  return (
    <>
      <DocumentSummaryCard summary={summary} />
      <Section label="Prescriber" value={prescription.prescriber_name} />
      <Section label="Prescribed date" value={prescription.prescribed_at} />
      {meds.length > 0 ? (
        <ul className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
          {meds.map((med) => (
            <li key={med.name} className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="font-medium text-[var(--eh-text-primary)]">{med.name}</p>
              <p className="mt-1 text-sm text-[var(--eh-text-secondary)]">
                {[med.dose, med.frequency, med.duration].filter(Boolean).join(" · ") || "—"}
              </p>
              {med.instructions ? (
                <p className="mt-1 text-xs text-[var(--eh-text-muted)]">{med.instructions}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--eh-text-secondary)]">No medications listed.</p>
      )}
    </>
  );
}

export function ReferralInsightsPanel({
  referral,
  summary,
  processingStatus,
}: {
  referral: ReferralRow | null;
  summary: string | null;
  processingStatus: string;
}) {
  if (!referral) {
    return (
      <p className="text-sm text-[var(--eh-text-secondary)]">
        {processingStatus === "processing"
          ? "Extraction in progress…"
          : "No structured referral data detected."}
      </p>
    );
  }

  return (
    <>
      <DocumentSummaryCard summary={summary} />
      <div className="max-h-[480px] space-y-2 overflow-y-auto">
        <Section label="Referring provider" value={referral.referring_provider} />
        <Section label="Referred to specialty" value={referral.referred_to_specialty} />
        <Section label="Referred to provider" value={referral.referred_to_provider} />
        <Section label="Referral date" value={referral.referral_date} />
        <Section label="Urgency" value={referral.urgency} />
        <Section label="Reason for referral" value={referral.reason_for_referral} />
        <Section label="Clinical summary" value={referral.clinical_summary} />
      </div>
    </>
  );
}
