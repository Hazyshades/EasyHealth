"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { depositToGateway, payForResource } from "@/lib/payments/gateway-client";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";

type Summary = {
  overview: string;
  key_findings: string[];
  changes: string[];
  questions_for_clinician: string[];
  when_to_seek_care: string;
  disclaimer: string;
};

export default function SummaryPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [paidAmount, setPaidAmount] = useState<string | null>(null);

  async function generateSummary() {
    setLoading(true);
    setError(null);
    try {
      await depositToGateway("0.1").catch(() => undefined);
      const result = await payForResource(`${window.location.origin}/api/doctor-summary`, {
        method: "POST",
      });
      setPaidAmount(result.formattedAmount);
      setSummary(result.data as Summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate summary");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Doctor summary</h1>
        <p className="text-muted-foreground">
          Clinician-ready educational summary · $0.05 USDC on Arc Network
        </p>
      </div>

      <Button onClick={generateSummary} disabled={loading} size="lg">
        {loading ? "Paying & generating…" : "Generate summary - $0.05"}
      </Button>

      {paidAmount && (
        <p className="text-sm text-teal-700">Paid {paidAmount} USDC via Arc Gateway</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {summary && (
        <article className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
          <section>
            <h2 className="font-semibold">Overview</h2>
            <p className="mt-2 text-sm">{summary.overview}</p>
          </section>
          <Section title="Key findings" items={summary.key_findings} />
          <Section title="Changes over time" items={summary.changes} />
          <Section title="Questions for your clinician" items={summary.questions_for_clinician} />
          <section>
            <h2 className="font-semibold">When to seek care</h2>
            <p className="mt-2 text-sm">{summary.when_to_seek_care}</p>
          </section>
          <p className="border-t pt-4 text-xs font-medium text-amber-800">
            {summary.disclaimer ?? MEDICAL_DISCLAIMER}
          </p>
        </article>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
