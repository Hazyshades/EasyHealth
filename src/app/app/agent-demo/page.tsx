"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SurfaceCard } from "@/components/ui/surface-card";
import { PageHeader } from "@/components/layout/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ensureGatewayFunded,
  payForResource,
} from "@/lib/payments/gateway-client";
import { useWallet } from "@/components/wallet-provider";

type AgentServiceId =
  | "quick-insight"
  | "trend-analysis"
  | "holistic-synthesis"
  | "clinician-summary";

type BiomarkerRow = {
  biomarker: string;
  key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
};

type Quote = {
  quoted_price_usdc?: string;
  price_breakdown?: { base: number; per_item: number; features: number; cap_applied: boolean };
  suggested_tier?: string;
  error?: string;
};

const SERVICES: { id: AgentServiceId; label: string; tier: string; base: string }[] = [
  { id: "quick-insight", label: "Quick insight", tier: "basic", base: "$0.003" },
  { id: "trend-analysis", label: "Trend analysis", tier: "plus", base: "$0.01" },
  { id: "holistic-synthesis", label: "Holistic synthesis", tier: "plus", base: "$0.01" },
  { id: "clinician-summary", label: "Clinician summary", tier: "pro", base: "$0.05" },
];

const SCENARIOS: Record<string, BiomarkerRow[]> = {
  normal: [
    { biomarker: "HbA1c", key: "hba1c", value: 5.2, unit: "%", ref_low: 4, ref_high: 5.6, observed_at: "2026-05-01" },
  ],
  borderline: [
    { biomarker: "HbA1c", key: "hba1c", value: 6.4, unit: "%", ref_low: 4, ref_high: 5.6, observed_at: "2026-05-01" },
    { biomarker: "LDL", key: "ldl", value: 142, unit: "mg/dL", ref_low: null, ref_high: 100, observed_at: "2026-05-01" },
  ],
  trend: [
    { biomarker: "HbA1c", key: "hba1c", value: 5.4, unit: "%", ref_low: 4, ref_high: 5.6, observed_at: "2025-11-01" },
    { biomarker: "HbA1c", key: "hba1c", value: 5.9, unit: "%", ref_low: 4, ref_high: 5.6, observed_at: "2026-02-01" },
    { biomarker: "HbA1c", key: "hba1c", value: 6.4, unit: "%", ref_low: 4, ref_high: 5.6, observed_at: "2026-05-01" },
  ],
};

function toRequestBody(
  rows: BiomarkerRow[],
  options: { depth: "standard" | "deep"; include_citations: boolean }
) {
  return {
    options: { depth: options.depth, include_citations: options.include_citations },
    data: {
      biomarkers: rows.map((r) => ({ ...r, source: "agent-demo-ui" })),
    },
  };
}

export default function AgentDemoPage() {
  const { fundGatewayWallet } = useWallet();

  const [service, setService] = useState<AgentServiceId>("quick-insight");
  const [rows, setRows] = useState<BiomarkerRow[]>(SCENARIOS.borderline);
  const [depth, setDepth] = useState<"standard" | "deep">("standard");
  const [includeCitations, setIncludeCitations] = useState(false);

  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [paidInfo, setPaidInfo] = useState<{ amount: string; tx: string } | null>(null);
  const [escalation, setEscalation] = useState<{ amount: string; tx: string; data: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const body = useMemo(
    () => toRequestBody(rows, { depth, include_citations: includeCitations }),
    [rows, depth, includeCitations]
  );

  function updateRow(idx: number, patch: Partial<BiomarkerRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { biomarker: "New marker", key: "new_marker", value: 0, unit: "", ref_low: null, ref_high: null, observed_at: "2026-05-01" },
    ]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetOutputs() {
    setResult(null);
    setPaidInfo(null);
    setEscalation(null);
    setError(null);
  }

  async function getQuote() {
    setQuoting(true);
    setQuote(null);
    resetOutputs();
    try {
      const res = await fetch(`/api/agent/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as Quote;
      if (res.status === 402) {
        setQuote(data);
      } else if (res.status === 400) {
        setQuote({ error: data.error ?? "Invalid request body (400)" });
      } else {
        setQuote({ error: `Unexpected status ${res.status}` });
      }
    } catch (e) {
      setQuote({ error: e instanceof Error ? e.message : "Quote failed" });
    } finally {
      setQuoting(false);
    }
  }

  async function payAndRun() {
    setPaying(true);
    resetOutputs();
    try {
      await ensureGatewayFunded("0.06", fundGatewayWallet);
      const url = `${window.location.origin}/api/agent/${service}`;
      const paid = await payForResource(url, { method: "POST", body });
      setResult(paid.data);
      setPaidInfo({ amount: paid.formattedAmount, tx: paid.transaction });

      const escalateRecommended = (paid.data as { escalate_recommended?: boolean })?.escalate_recommended;
      if (service === "quick-insight" && escalateRecommended) {
        const escUrl = `${window.location.origin}/api/agent/clinician-summary`;
        const escBody = toRequestBody(rows, { depth: "deep", include_citations: true });
        const esc = await payForResource(escUrl, { method: "POST", body: escBody });
        setEscalation({ amount: esc.formattedAmount, tx: esc.transaction, data: esc.data });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent API demo"
        subtitle="Simulate a buyer agent: get a dynamic x402 quote, then pay USDC on Arc for a health insight"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: request builder */}
        <SurfaceCard padding="md" className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Service</label>
            <Select value={service} onValueChange={(v) => { setService(v as AgentServiceId); setQuote(null); resetOutputs(); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label} · {s.tier} · from {s.base}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sample scenario</label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(SCENARIOS).map((name) => (
                <Button
                  key={name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setRows(SCENARIOS[name]); setQuote(null); resetOutputs(); }}
                >
                  {name}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Biomarkers ({rows.length})</label>
              <Button type="button" variant="ghost" size="sm" onClick={addRow}>
                + Add
              </Button>
            </div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_60px_90px_auto] items-center gap-2">
                  <Input
                    value={r.biomarker}
                    onChange={(e) => updateRow(i, { biomarker: e.target.value })}
                    className="h-8"
                    placeholder="Name"
                  />
                  <Input
                    type="number"
                    value={r.value}
                    onChange={(e) => updateRow(i, { value: parseFloat(e.target.value) || 0 })}
                    className="h-8"
                    placeholder="Value"
                  />
                  <Input
                    value={r.unit}
                    onChange={(e) => updateRow(i, { unit: e.target.value })}
                    className="h-8"
                    placeholder="Unit"
                  />
                  <Input
                    value={r.observed_at}
                    onChange={(e) => updateRow(i, { observed_at: e.target.value })}
                    className="h-8"
                    placeholder="Date"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-muted-foreground hover:text-red-600 px-1 text-lg leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Depth</label>
              <Select value={depth} onValueChange={(v) => setDepth(v as "standard" | "deep")}>
                <SelectTrigger className="h-8 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">standard</SelectItem>
                  <SelectItem value="deep">deep (+$0.02)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeCitations}
                onChange={(e) => setIncludeCitations(e.target.checked)}
              />
              Include citations (+$0.01)
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" variant="outline" onClick={getQuote} disabled={quoting || rows.length === 0}>
              {quoting ? "Getting quote…" : "1 · Get quote (402)"}
            </Button>
            <Button type="button" onClick={payAndRun} disabled={paying || rows.length === 0}>
              {paying ? "Paying & running…" : "2 · Pay & get insight"}
            </Button>
          </div>
        </SurfaceCard>

        {/* Right: results */}
        <div className="space-y-4">
          {quote && (
            <SurfaceCard padding="md" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Quote (HTTP 402)</h3>
                {quote.quoted_price_usdc && (
                  <Badge>{quote.quoted_price_usdc} USDC</Badge>
                )}
              </div>
              {quote.error ? (
                <p className="text-sm text-red-600">{quote.error}</p>
              ) : (
                <div className="text-sm text-muted-foreground space-y-1">
                  {quote.price_breakdown && (
                    <ul className="space-y-0.5">
                      <li>base: ${quote.price_breakdown.base}</li>
                      <li>per-item: ${quote.price_breakdown.per_item}</li>
                      <li>features: ${quote.price_breakdown.features}</li>
                      {quote.price_breakdown.cap_applied && <li className="text-amber-600">tier cap applied</li>}
                    </ul>
                  )}
                  {quote.suggested_tier && (
                    <p className="text-amber-700">
                      Seller suggests cheaper tier: <strong>{quote.suggested_tier}</strong>
                    </p>
                  )}
                </div>
              )}
            </SurfaceCard>
          )}

          {error && (
            <SurfaceCard padding="md">
              <p className="text-sm text-red-600 whitespace-pre-wrap">{error}</p>
            </SurfaceCard>
          )}

          {paidInfo && (
            <SurfaceCard padding="md" className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Insight (paid)</h3>
                <Badge variant="secondary">{paidInfo.amount} USDC</Badge>
              </div>
              {paidInfo.tx && (
                <p className="text-xs text-muted-foreground break-all">tx: {paidInfo.tx}</p>
              )}
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </SurfaceCard>
          )}

          {escalation && (
            <SurfaceCard padding="md" className="space-y-2 border-teal-300">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-teal-700">
                  Autonomous escalation → clinician-summary
                </h3>
                <Badge variant="secondary">{escalation.amount} USDC</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                The agent detected a borderline result and bought the Pro tier automatically.
              </p>
              {escalation.tx && (
                <p className="text-xs text-muted-foreground break-all">tx: {escalation.tx}</p>
              )}
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">
                {JSON.stringify(escalation.data, null, 2)}
              </pre>
            </SurfaceCard>
          )}

          <SurfaceCard padding="sm" className="text-xs text-muted-foreground">
            See live A2A totals on the{" "}
            <Link href="/app/agent-traction" className="text-teal-700 hover:underline">
              traction dashboard
            </Link>
            . Educational use only — not medical advice.
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
