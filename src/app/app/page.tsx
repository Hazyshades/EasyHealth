"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ClipboardList, FileText, FlaskConical, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Document = {
  id: string;
  status: string;
};

const quickLinks = [
  { href: "/app/profile", label: "View Health Profile", icon: ArrowRight },
  { href: "/app/biomarkers", label: "View Biomarkers", icon: FlaskConical },
  { href: "/app/documents", label: "Browse Documents", icon: FileText },
];

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents ?? []))
      .finally(() => setLoading(false));
  }, []);

  const completed = documents.filter((d) => d.status === "completed").length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
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
          <MetricCard label="Completed records" value={completed} icon={FileText} />
          <MetricCard label="Quick links" icon={ArrowRight}>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cn(
                      "inline-flex items-center gap-2 text-sm font-medium text-[var(--eh-health)]",
                      "transition-colors duration-150 hover:text-[var(--eh-brand)]"
                    )}
                  >
                    <link.icon className="size-3.5 opacity-70" aria-hidden />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </MetricCard>
          <SurfaceCard padding="lg" className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[var(--eh-text-secondary)]">Reports</p>
              <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
                <ClipboardList className="size-4" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-sm text-[var(--eh-text-secondary)]">
              Generate educational health reports from your uploaded lab records.
            </p>
            <div className="mt-auto flex flex-col gap-2 pt-6">
              <Button asChild className="rounded-xl bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90">
                <Link href="/app/reports/create">Generate report — $0.05</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-[var(--eh-border)] bg-white"
              >
                <Link href="/app/reports">View report history</Link>
              </Button>
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  );
}
