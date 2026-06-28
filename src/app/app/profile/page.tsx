"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BodyMap, BodyMapLegend } from "@/components/body-map";
import { Button } from "@/components/ui/button";
import { MEDICAL_DISCLAIMER } from "@/lib/schemas/biomarkers";
import type { HealthProfileResult } from "@/lib/health-systems";

export default function HealthProfilePage() {
  const [profile, setProfile] = useState<HealthProfileResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/health-profile")
      .then((r) => r.json())
      .then(setProfile)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading health profile…</p>;
  }

  if (!profile || profile.records_used_count === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Health Profile</h1>
          <p className="text-muted-foreground">
            Educational overview based on your uploaded records
          </p>
        </div>
        <div className="rounded-xl border bg-white p-8 text-center">
          <h2 className="text-lg font-semibold">No data yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Upload lab results to see current state assessments across body systems.
          </p>
          <Button asChild className="mt-4">
            <Link href="/app/upload?type=lab">Upload your lab</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Health Profile</h1>
        <p className="text-muted-foreground">
          Current state assessments and factual insights from your records
        </p>
      </div>

      <BodyMap
        systems={profile.systems}
        overallStateScore={profile.overall_state_score}
        overallDataConfidence={profile.overall_data_confidence}
      />
      <BodyMapLegend />

      <section className="rounded-xl border bg-white p-6">
        <h2 className="font-semibold">Used {profile.records_used_count} records</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {profile.sources.map((source) => (
            <li key={source.id} className="flex flex-wrap gap-2 border-b pb-2 last:border-0">
              <span className="font-medium">{source.original_filename}</span>
              {source.lab_name && (
                <span className="text-muted-foreground">{source.lab_name}</span>
              )}
              {source.observed_at && (
                <span className="text-muted-foreground">{source.observed_at}</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-muted-foreground">{MEDICAL_DISCLAIMER}</p>
    </div>
  );
}
