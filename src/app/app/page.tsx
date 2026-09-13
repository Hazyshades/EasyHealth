"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Upload } from "lucide-react";
import { DashboardWidgetGrid } from "@/components/dashboard/dashboard-widget-grid";
import { OnboardingSuccessBanner } from "@/components/onboarding/onboarding-success-banner";
import { PlatformTour } from "@/components/onboarding/platform-tour";
import { PageHeader } from "@/components/layout/page-header";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { greetingLabel } from "@/lib/display-name";
import type { HealthProfileResult } from "@/lib/health-systems";
import type { HealthProfileAssessmentDisplayState } from "@/lib/health-profile-assessment-state";
import type { HealthProfileAssessmentRead } from "@/lib/health-profile-assessment-read";

type DashboardHealthProfileResponse = HealthProfileResult & {
  assessment: HealthProfileAssessmentRead;
};

const HEALTH_PROFILE_LOAD_ERROR =
  "Health Profile is temporarily unavailable. Please try again.";

type Document = {
  id: string;
  status: string;
};

type ProfileOnboarding = {
  first_name: string | null;
  last_name: string | null;
  onboarding?: {
    showPlatformTour: boolean;
    showSuccessBanner: boolean;
  };
};

function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [profile, setProfile] = useState<HealthProfileResult | null>(null);
  const [assessmentState, setAssessmentState] = useState<
    HealthProfileAssessmentDisplayState | undefined
  >();
  const [assessmentError, setAssessmentError] = useState<string | null>(null);
  const [healthProfileLoadError, setHealthProfileLoadError] = useState<string | null>(
    null,
  );
  const [accountProfile, setAccountProfile] =
    useState<ProfileOnboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTour, setShowTour] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerDismissing, setBannerDismissing] = useState(false);

  const loadData = useCallback(() => {
    const healthProfileRequest = fetch("/api/health-profile").then(
      async (response) => {
        if (!response.ok) {
          throw new Error(HEALTH_PROFILE_LOAD_ERROR);
        }
        return response.json();
      },
    );

    return Promise.allSettled([
      fetch("/api/documents").then((r) => r.json()),
      healthProfileRequest,
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(([documentsResult, healthProfileResult, accountResult]) => {
        if (documentsResult.status === "fulfilled") {
          setDocuments(documentsResult.value.documents ?? []);
        }
        if (accountResult.status === "fulfilled") {
          setAccountProfile(accountResult.value);
          setShowTour(Boolean(accountResult.value.onboarding?.showPlatformTour));
          setShowBanner(Boolean(accountResult.value.onboarding?.showSuccessBanner));
        }
        if (healthProfileResult.status === "rejected") {
          throw healthProfileResult.reason;
        }

        const healthProfileData =
          healthProfileResult.value as DashboardHealthProfileResponse;
        setHealthProfileLoadError(null);
        const hasReportedResults =
          (healthProfileData?.reported_results?.reported_count ?? 0) > 0;
        setProfile(
          healthProfileData &&
            healthProfileData.profile_display_state !== "onboarding" &&
            (healthProfileData.records_used_count > 0 || hasReportedResults)
            ? healthProfileData
            : null,
        );
        setAssessmentState(healthProfileData.assessment.display_state);
        setAssessmentError(healthProfileData.assessment.error_message);
      })
      .catch(() => {
        setHealthProfileLoadError(HEALTH_PROFILE_LOAD_ERROR);
      });
  }, []);

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  async function patchOnboarding(
    action: "dismiss_tour" | "complete_tour" | "dismiss_banner",
  ) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_action: action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to update onboarding");
    }
    return loadData();
  }

  const completed = documents.filter((d) => d.status === "completed").length;
  const processingDocuments = documents.some(
    (document) =>
      document.status === "processing" || document.status === "queued",
  );
  const lastUpdated = profile?.sources[0]?.observed_at ?? null;
  const name = greetingLabel(
    accountProfile?.first_name,
    accountProfile?.last_name,
    null,
  );

  return (
    <div>
      <PageHeader
        title={`${timeGreeting()}, ${name}`}
        subtitle="How are you feeling today?"
        compact
        actions={
          <>
            <Button
              asChild
              data-tour="add-document"
              variant="outline"
              className="rounded-xl border-[var(--eh-border)] bg-white"
            >
              <Link href="/app/upload">Add document</Link>
            </Button>
            <Button
              asChild
              data-tour="reports"
              className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
            >
              <Link href="/app/reports/create">Generate report</Link>
            </Button>
          </>
        }
      />

      {showBanner ? (
        <OnboardingSuccessBanner
          dismissing={bannerDismissing}
          onDismiss={async () => {
            setBannerDismissing(true);
            try {
              await patchOnboarding("dismiss_banner");
              setShowBanner(false);
            } finally {
              setBannerDismissing(false);
            }
          }}
        />
      ) : null}

      {loading ? (
        <>
          <div className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SurfaceCard key={i} padding="lg" className="h-[220px] space-y-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-12 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </SurfaceCard>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SurfaceCard key={i} padding="lg" className="h-[220px] space-y-4">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
              </SurfaceCard>
            ))}
          </div>
        </>
      ) : completed === 0 && !processingDocuments && !profile && !healthProfileLoadError ? (
        <>
          <SurfaceCard padding="lg" className="mb-6 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
              <Upload className="size-6" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-[var(--eh-text-primary)]">
              No lab records yet
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[var(--eh-text-secondary)]">
              Upload your first lab to extract biomarkers and build your health
              profile.
            </p>
            <Button
              asChild
              className="mt-6 rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
            >
              <Link href="/app/upload">Upload lab results</Link>
            </Button>
          </SurfaceCard>
          <DashboardWidgetGrid
            data={{
              completedDocuments: completed,
              processingDocuments,
              healthProfile: profile,
              lastUpdated,
              assessmentState,
              assessmentError,
              healthProfileLoadError,
            }}
          />
        </>
      ) : (
        <DashboardWidgetGrid
          data={{
            completedDocuments: completed,
            processingDocuments,
            healthProfile: profile,
            lastUpdated,
            assessmentState,
            assessmentError,
            healthProfileLoadError,
          }}
        />
      )}

      <PlatformTour
        open={showTour}
        onDismiss={async () => {
          try {
            await patchOnboarding("dismiss_tour");
          } finally {
            setShowTour(false);
          }
        }}
        onComplete={async () => {
          try {
            await patchOnboarding("complete_tour");
            setShowBanner(true);
          } finally {
            setShowTour(false);
          }
        }}
      />
    </div>
  );
}
