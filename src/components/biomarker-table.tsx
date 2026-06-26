"use client";

import Link from "next/link";
import { useWallet } from "@/components/wallet-provider";
import { Button } from "@/components/ui/button";

type Observation = {
  id: string;
  name: string;
  biomarker_key: string;
  value: number;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  observed_at: string;
  documents?: { original_filename: string } | null;
};

export function BiomarkerTable({ observations }: { observations: Observation[] }) {
  if (!observations.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground mb-4">No biomarkers yet.</p>
        <Button asChild>
          <Link href="/app/upload">Upload your first lab</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-3">Biomarker</th>
            <th className="p-3">Value</th>
            <th className="p-3">Reference</th>
            <th className="p-3">Date</th>
            <th className="p-3">Source</th>
          </tr>
        </thead>
        <tbody>
          {observations.map((o) => (
            <tr key={o.id} className="border-t">
              <td className="p-3 font-medium">{o.name}</td>
              <td className="p-3">
                {o.value} {o.unit}
              </td>
              <td className="p-3 text-muted-foreground">
                {o.ref_low != null && o.ref_high != null
                  ? `${o.ref_low} – ${o.ref_high}`
                  : "-"}
              </td>
              <td className="p-3">{o.observed_at}</td>
              <td className="p-3 text-muted-foreground">
                {o.documents?.original_filename ?? "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
