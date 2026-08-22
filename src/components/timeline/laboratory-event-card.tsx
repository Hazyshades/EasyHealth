import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { buildObservationSourceHref, type LaboratoryPanelGroup, type PanelMemberObservationGroup, type TimelineLaboratoryObservation } from "@/lib/timeline/panel-grouping";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatusChip } from "@/components/ui/status-chip";

export type LaboratoryEventDocument = Readonly<{
  id: string;
  original_filename: string;
  lab_name: string | null;
}>;

type LaboratoryEventCardProps = Readonly<{
  document: LaboratoryEventDocument;
  panels: readonly LaboratoryPanelGroup[];
  ungrouped: readonly TimelineLaboratoryObservation[];
  totalObservationCount: number;
  eventHref: string;
}>;

function displayObservationValue(observation: TimelineLaboratoryObservation): string {
  if (observation.value_kind && observation.value_kind !== "numeric") {
    return observation.value_text?.trim() || String(observation.value ?? "—");
  }
  if (observation.value === null || observation.value === undefined || observation.value === "") {
    return observation.value_text?.trim() || "—";
  }
  return String(observation.value);
}

function displayReferenceRange(observation: TimelineLaboratoryObservation): string | null {
  if (observation.ref_low === null && observation.ref_high === null) return null;
  return `Reference ${observation.ref_low ?? "—"}–${observation.ref_high ?? "—"}`;
}

function SourceLink({
  documentId,
  sourcePage,
}: {
  documentId: string;
  sourcePage: number | null | undefined;
}) {
  const href = buildObservationSourceHref(documentId, sourcePage);
  if (!href) return null;
  const validSourcePage =
    typeof sourcePage === "number" && Number.isInteger(sourcePage) && sourcePage > 0
      ? sourcePage
      : null;
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-[var(--eh-brand)] hover:underline"
    >
      Source{validSourcePage === null ? "" : ` · page ${validSourcePage}`}
      <ExternalLink className="size-3" aria-hidden />
    </Link>
  );
}

function ObservationRow({
  member,
  observation,
  documentId,
}: {
  member: PanelMemberObservationGroup;
  observation: TimelineLaboratoryObservation;
  documentId: string;
}) {
  const referenceRange = displayReferenceRange(observation);
  const sourceDocumentId = observation.document_id ?? documentId;
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-[var(--eh-text-primary)]">
              {member.definitionDisplayName}
            </p>
            <StatusChip variant="neutral">{member.roleLabel}</StatusChip>
          </div>
          {observation.name && observation.name !== member.definitionDisplayName ? (
            <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">Reported as {observation.name}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-sm font-semibold text-[var(--eh-text-primary)]">
          {displayObservationValue(observation)} {observation.unit ?? ""}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--eh-text-muted)]">
        {referenceRange ? <span>{referenceRange}</span> : null}
        {observation.specimen && observation.specimen !== "unspecified" ? (
          <span>Specimen: {observation.specimen}</span>
        ) : null}
        <SourceLink documentId={sourceDocumentId} sourcePage={observation.source_page} />
      </div>
    </li>
  );
}

function MissingMemberRow({ member }: { member: PanelMemberObservationGroup }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--eh-text-secondary)]">
          {member.definitionDisplayName}
        </p>
        <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">Not reported in this event</p>
      </div>
      <StatusChip variant="neutral">{member.roleLabel}</StatusChip>
    </li>
  );
}

function PanelSection({
  group,
  documentId,
}: {
  group: LaboratoryPanelGroup;
  documentId: string;
}) {
  return (
    <section
      aria-labelledby={`timeline-panel-${documentId}-${group.panel.key}`}
      className="rounded-2xl border border-[var(--eh-border-soft)] bg-[var(--eh-canvas-bg)] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            id={`timeline-panel-${documentId}-${group.panel.key}`}
            className="text-sm font-semibold text-[var(--eh-text-primary)]"
          >
            {group.panel.displayName}
          </h3>
          <p className="mt-1 text-xs text-[var(--eh-text-muted)]">
            {group.reportedMemberCount} measurement{group.reportedMemberCount === 1 ? "" : "s"} reported
            {group.missingMemberCount > 0
              ? ` · ${group.missingMemberCount} not reported in this event`
              : ""}
          </p>
        </div>
        <StatusChip variant="neutral">Panel</StatusChip>
      </div>
      <ul className="mt-3 space-y-2">
        {group.members.map((member) =>
          member.missing ? (
            <MissingMemberRow
              key={member.member.measurementDefinitionKey}
              member={member}
            />
          ) : (
            member.observations.map((observation) => (
              <ObservationRow
                key={`${member.member.measurementDefinitionKey}-${observation.id}`}
                member={member}
                observation={observation}
                documentId={documentId}
              />
            ))
          ),
        )}
      </ul>
    </section>
  );
}

function UngroupedSection({
  observations,
  documentId,
}: {
  observations: readonly TimelineLaboratoryObservation[];
  documentId: string;
}) {
  if (observations.length === 0) return null;
  return (
    <section
      aria-labelledby={`timeline-panel-${documentId}-ungrouped`}
      className="rounded-2xl border border-slate-200 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id={`timeline-panel-${documentId}-ungrouped`}
          className="text-sm font-semibold text-[var(--eh-text-primary)]"
        >
          Other measurements
        </h3>
        <StatusChip variant="neutral">Ungrouped</StatusChip>
      </div>
      <ul className="mt-3 space-y-2">
        {observations.map((observation) => {
          const sourceDocumentId = observation.document_id ?? documentId;
          return (
            <li key={observation.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--eh-text-primary)]">
                    {observation.name || observation.measurement_definition_key || "Unresolved measurement"}
                  </p>
                  {observation.measurement_definition_key ? (
                    <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">
                      {observation.measurement_definition_key}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-[var(--eh-text-muted)]">Definition not available</p>
                  )}
                </div>
                <p className="shrink-0 text-sm font-semibold text-[var(--eh-text-primary)]">
                  {displayObservationValue(observation)} {observation.unit ?? ""}
                </p>
              </div>
              <div className="mt-1">
                <SourceLink documentId={sourceDocumentId} sourcePage={observation.source_page} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LaboratoryEventCard({
  document,
  panels,
  ungrouped,
  totalObservationCount,
  eventHref,
}: LaboratoryEventCardProps) {
  return (
    <SurfaceCard padding="md" className="space-y-4" data-testid="laboratory-event-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--eh-text-muted)]">
            Laboratory event
          </p>
          <h2 className="mt-1 truncate text-base font-semibold text-[var(--eh-text-primary)]">
            {document.lab_name || document.original_filename}
          </h2>
          <p className="mt-1 truncate text-xs text-[var(--eh-text-muted)]">{document.original_filename}</p>
        </div>
        <Link
          href={eventHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--eh-border)] px-2.5 py-1.5 text-xs font-medium text-[var(--eh-text-secondary)] hover:border-[var(--eh-brand)] hover:text-[var(--eh-brand)]"
        >
          Open document
          <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>

      {totalObservationCount === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-sm text-[var(--eh-text-secondary)]">
          No normalized measurements are available for this event yet.
        </p>
      ) : panels.length === 0 && ungrouped.length > 0 ? (
        <UngroupedSection observations={ungrouped} documentId={document.id} />
      ) : (
        <div className="space-y-3">
          {panels.map((group) => (
            <PanelSection key={group.panel.key} group={group} documentId={document.id} />
          ))}
          <UngroupedSection observations={ungrouped} documentId={document.id} />
        </div>
      )}
    </SurfaceCard>
  );
}
