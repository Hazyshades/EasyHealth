import Link from "next/link";
import { ArrowRight, Check, CircleHelp } from "lucide-react";
import { ContextBreadcrumbs } from "@/components/layout/context-breadcrumbs";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getKnowledgeArticleBySlug } from "@/lib/knowledge-base";
import { getKnowledgeArticleRecordByMeasurementKey } from "@/lib/knowledge-base/links";
import type { PanelDefinition, PanelMember } from "@/lib/biomarkers";

function MemberRow({ member }: { member: PanelMember }) {
  const relatedRecord = getKnowledgeArticleRecordByMeasurementKey(
    member.measurementDefinitionKey,
  );
  const relatedArticle = relatedRecord
    ? getKnowledgeArticleBySlug(relatedRecord.slug)
    : null;
  const label =
    relatedArticle?.definition.displayName ?? member.measurementDefinitionKey;
  const roleLabel =
    member.role === "required" ? "Usually included" : "May be included";

  return (
    <li className="rounded-xl border border-[var(--eh-border)] bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {relatedArticle ? (
            <Link
              href={`/knowledge/biomarkers/${encodeURIComponent(relatedArticle.record.slug)}`}
              className="group inline-flex max-w-full items-center gap-1.5 text-sm font-semibold text-[var(--eh-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)]"
            >
              <span className="truncate">{label}</span>
              <ArrowRight
                className="size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold text-[var(--eh-text-primary)]">
              {label}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--eh-text-secondary)]">
            {roleLabel}
          </p>
        </div>
        <span
          className={
            member.role === "required"
              ? "inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--eh-health)]/30 bg-[var(--eh-page-bg)] px-2 py-1 text-xs font-medium text-[var(--eh-health)]"
              : "inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--eh-border)] bg-[var(--eh-canvas-bg)] px-2 py-1 text-xs font-medium text-[var(--eh-text-secondary)]"
          }
        >
          {member.role === "required" ? (
            <Check className="size-3" aria-hidden />
          ) : (
            <CircleHelp className="size-3" aria-hidden />
          )}
          {member.role}
        </span>
      </div>
      {!relatedArticle ? (
        <p className="mt-3 text-xs text-[var(--eh-text-muted)]">
          Article not published for this member yet.
        </p>
      ) : null}
    </li>
  );
}

export function PanelArticle({ panel }: { panel: PanelDefinition }) {
  const orderedMembers = [...panel.members].sort(
    (left, right) => left.displayOrder - right.displayOrder,
  );
  const requiredMembers = orderedMembers.filter(
    (member) => member.role === "required",
  );
  const optionalMembers = orderedMembers.filter(
    (member) => member.role === "optional",
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <ContextBreadcrumbs
        items={[
          { label: "Knowledge Base", href: "/knowledge" },
          { label: panel.displayName },
        ]}
      />

      <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="mb-2 text-sm font-medium text-[var(--eh-health)]">
            Panel guide
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[var(--eh-text-primary)] [text-wrap:balance]">
            {panel.displayName}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--eh-text-secondary)] [text-wrap:pretty]">
            A panel is a group of related measurements. It helps organize a
            report, but the exact composition varies by laboratory, method, and
            the purpose of the order.
          </p>
        </div>
        <Link
          href="/app/biomarkers"
          className="inline-flex items-center gap-2 rounded-md bg-[var(--eh-brand)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338ca] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--eh-brand)] focus-visible:ring-offset-2"
        >
          View your biomarkers
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="panel-members-heading" className="min-w-0">
          <SurfaceCard padding="lg">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="panel-members-heading"
                  className="text-xl font-semibold text-[var(--eh-text-primary)]"
                >
                  Measurements in this panel
                </h2>
                <p className="mt-1 text-sm leading-6 text-[var(--eh-text-secondary)]">
                  {panel.members.length} catalog member
                  {panel.members.length === 1 ? "" : "s"} shown in the reviewed
                  panel definition.
                </p>
              </div>
              <span className="text-xs text-[var(--eh-text-muted)]">
                Display order preserved
              </span>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                  Usually included
                </h3>
                <ul className="mt-3 space-y-3">
                  {requiredMembers.map((member) => (
                    <MemberRow
                      key={member.measurementDefinitionKey}
                      member={member}
                    />
                  ))}
                </ul>
              </div>
              {optionalMembers.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--eh-text-primary)]">
                    May be included
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {optionalMembers.map((member) => (
                      <MemberRow
                        key={member.measurementDefinitionKey}
                        member={member}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </SurfaceCard>
        </section>

        <aside className="space-y-4">
          <SurfaceCard padding="md">
            <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
              Also called
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-[var(--eh-text-secondary)]">
              {panel.alternateNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </SurfaceCard>
          <SurfaceCard padding="md" className="bg-[var(--eh-page-bg)]">
            <h2 className="text-base font-semibold text-[var(--eh-text-primary)]">
              Composition varies
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--eh-text-secondary)]">
              Not every laboratory includes every member. Use the measurements
              printed on your own report as the source of truth.
            </p>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}
