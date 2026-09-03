import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { LibraryIcon } from "@/components/icons";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { CBC_PANEL_ARTICLE } from "@/lib/knowledge-base";

export default function KnowledgePage() {
  return (
    <div className="pb-8">
      <ContextBreadcrumbs
        items={[{ href: "/app", label: "Dashboard" }, { label: "Knowledge" }]}
      />
      <PageHeader
        title="Knowledge"
        subtitle="Plain-language guides that help you read your health record without changing it."
      />

      <section aria-labelledby="knowledge-panel-guides">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2
              id="knowledge-panel-guides"
              className="text-balance text-base font-semibold text-[var(--eh-text-primary)]"
            >
              Panel guides
            </h2>
            <p className="mt-1 max-w-[75ch] text-pretty text-sm text-[var(--eh-text-secondary)]">
              A panel is a group of related measurements, not a promise that
              every report has the same list.
            </p>
          </div>
        </div>

        <SurfaceCard padding="lg" className="max-w-3xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--eh-brand-soft)] text-[var(--eh-brand)]">
              <LibraryIcon size={22} aria-hidden />
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip variant="neutral">Educational preview</StatusChip>
              <StatusChip variant="info">Clinical review pending</StatusChip>
            </div>
          </div>
          <h3 className="mt-5 text-balance text-xl font-semibold text-[var(--eh-text-primary)]">
            {CBC_PANEL_ARTICLE.title}
          </h3>
          <p className="mt-2 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            {CBC_PANEL_ARTICLE.summary}
          </p>
          <p className="mt-3 max-w-[75ch] text-pretty text-sm leading-6 text-[var(--eh-text-secondary)]">
            See how red-cell, white-cell, and platelet measurements fit
            together, which members are often optional, and where your saved CBC
            results appear.
          </p>
          <Button
            asChild
            className="mt-5 bg-[var(--eh-brand)] hover:bg-[var(--eh-brand)]/90"
          >
            <Link href="/app/knowledge/panels/cbc">
              Read the CBC guide
              <ArrowUpRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </SurfaceCard>
      </section>

      <p className="mt-6 max-w-[75ch] text-pretty text-xs leading-5 text-[var(--eh-text-muted)]">
        Knowledge articles explain terminology and organization. They do not
        replace a clinician's advice or change how your results are assessed.
      </p>
    </div>
  );
}
