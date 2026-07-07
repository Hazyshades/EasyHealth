"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";

type TractionStats = {
  total_usdc_volume: number;
  total_calls: number;
  unique_payers: number;
  settle_tx_count: number;
  calls_by_tier: Record<string, number>;
  calls_by_endpoint: Record<string, number>;
};

export default function AgentTractionPage() {
  const [stats, setStats] = useState<TractionStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agent/traction")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStats(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const tierChart = stats
    ? Object.entries(stats.calls_by_tier).map(([tier, count]) => ({ tier, count }))
    : [];

  const endpointChart = stats
    ? Object.entries(stats.calls_by_endpoint).map(([endpoint, count]) => ({
        endpoint: endpoint.replace("/api/agent/", ""),
        count,
      }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent traction"
        subtitle="Real A2A payment volume from settled x402 receipts on Arc testnet"
      />

      {error ? (
        <SurfaceCard className="p-4 text-sm text-red-600">{error}</SurfaceCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SurfaceCard className="p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">USDC volume</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            ${(stats?.total_usdc_volume ?? 0).toFixed(4)}
          </p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Paid calls</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats?.total_calls ?? 0}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">Unique payers</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats?.unique_payers ?? 0}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-muted-foreground text-xs uppercase tracking-wide">On-chain settles</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{stats?.settle_tx_count ?? 0}</p>
        </SurfaceCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SurfaceCard className="p-4">
          <h2 className="mb-4 text-sm font-medium">Calls by tier</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tierChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="tier" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-4">
          <h2 className="mb-4 text-sm font-medium">Calls by endpoint</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={endpointChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="endpoint" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-2, var(--primary)))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
