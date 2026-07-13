import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

/** Renders simple `**bold**` segments from model output as <strong>. */
function renderReportText(text: string) {
  if (!text.includes("**")) return text;

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export type ReportContent = {
  overview: string;
  key_findings: string[];
  changes: string[];
  questions_for_clinician: string[];
  when_to_seek_care: string;
  disclaimer: string;
};

export function ReportBody({ content }: { content: ReportContent }) {
  return (
    <article className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
      <section>
        <h2 className="font-semibold">Overview</h2>
        <p className="mt-2 text-sm">{renderReportText(content.overview)}</p>
      </section>
      <ReportSection title="Key findings" items={content.key_findings} />
      <ReportSection title="Changes over time" items={content.changes} />
      <ReportSection title="Questions for your clinician" items={content.questions_for_clinician} />
      <section>
        <h2 className="font-semibold">When to seek care</h2>
        <p className="mt-2 text-sm">{renderReportText(content.when_to_seek_care)}</p>
      </section>
      <p className="border-t pt-4 text-xs font-medium text-amber-800">
        {content.disclaimer ?? MEDICAL_DISCLAIMER}
      </p>
    </article>
  );
}

function ReportSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--eh-text-muted)]">
          No entries were generated for this section.
        </p>
      ) : (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
          {items.map((item, index) => (
            <li key={`${title}-${index}`}>{renderReportText(item)}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
