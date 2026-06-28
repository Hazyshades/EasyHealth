"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookIcon, HandHeartIcon, LibraryIcon } from "@/components/icons";
import { DashboardCardIcon, useAnimatedIconHover } from "@/components/icons/use-animated-icon-hover";
import { Upload } from "lucide-react";
import { OverallAssessmentCard } from "@/components/overall-assessment-card";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import type { HealthProfileResult } from "@/lib/health-systems";

type Document = {
  id: string;
  status: string;
};

function ReportsDashboardCard() {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Reports</p>
        <DashboardCardIcon icon={BookIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        Generate educational health reports from your uploaded lab records.
      </p>
      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/reports/create">Generate report — $0.05</Link>
        </Button>
        <Button asChild variant="outline" className="rounded-xl border-[var(--eh-border)] bg-white">
          <Link href="/app/reports">View report history</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}

function EmptyAssessmentCard() {
  const { iconRef, hoverProps } = useAnimatedIconHover();

  return (
    <SurfaceCard padding="lg" className="flex h-full flex-col" {...hoverProps}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Overall assessment</p>
        <DashboardCardIcon icon={HandHeartIcon} iconRef={iconRef} />
      </div>
      <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
        Upload lab records to see your health profile score.
      </p>
      <div className="mt-auto pt-6">
        <Button asChild className="w-full rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
          <Link href="/app/upload">Upload your lab</Link>
        </Button>
      </div>
    </SurfaceCard>
  );
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [profile, setProfile] = useState<HealthProfileResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/documents").then((r) => r.json()),
      fetch("/api/health-profile").then((r) => r.json()),
    ])
      .then(([documentsData, profileData]) => {
        setDocuments(documentsData.documents ?? []);
        setProfile(profileData?.records_used_count > 0 ? profileData : null);
      })
      .finally(() => setLoading(false));
  }, []);

  const completed = documents.filter((d) => d.status === "completed").length;
  const lastUpdated = profile?.sources[0]?.observed_at ?? null;

  return (
    <div>
      <PageHeader
        subtitle="Your personal health record at a glance"
        compact
        actions={
          <>
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-[var(--eh-border)] bg-white"
            >
              <Link href="/app/upload">Add document</Link>
            </Button>
            <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
              <Link href="/app/reports/create">Generate report</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <p className="text-sm text-[var(--eh-text-secondary)]">Loading…</p>
      ) : completed === 0 ? (
        <SurfaceCard padding="lg" className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
            <Upload className="size-6" aria-hidden />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[var(--eh-text-primary)]">
            No lab records yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eh-text-secondary)]">
            Upload your first lab to extract biomarkers and build your health profile.
          </p>
          <Button asChild className="mt-6 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
            <Link href="/app/upload">Upload your lab — $0.01</Link>
          </Button>
        </SurfaceCard>
      ) : (
        <div className="grid gap-5 md:grid-cols-3">
          <MetricCard label="Completed records" value={completed} icon={LibraryIcon} />
          {profile ? (
            <OverallAssessmentCard
              overallStateScore={profile.overall_state_score}
              overallDataConfidence={profile.overall_data_confidence}
              recordsUsedCount={profile.records_used_count}
              lastUpdated={lastUpdated}
              variant="compact"
              showProfileLink
            />
          ) : (
            <EmptyAssessmentCard />
          )}
          <ReportsDashboardCard />
        </div>
      )}
    </div>
  );
}
