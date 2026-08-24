"use client";

import Link from "next/link";
import { buildHealthNavigationPath } from "@/lib/health-navigation";
import {
  sourceRegionCanRender,
} from "@/lib/documents/source-region";
import type {
  BodySystemId,
  HealthProfileScoreProvenance,
  ScoreContributor,
  ScoreExclusion,
  SystemScoreProvenance,
} from "@/lib/health-systems";

const EXCLUSION_LABELS: Record<ScoreExclusion["reason"], string> = {
  no_active_revision: "No active verified resolution",
  incomplete_resolution: "Resolution is incomplete",
  candidate_only_identity: "No reviewed assessment identity",
  assessment_binding_ineligible: "Not eligible for assessment binding",
  non_numeric_value: "Value is not numeric",
  missing_reference_range: "No usable document reference range",
  specimen_mismatch: "Specimen does not match the reviewed definition",
  not_core: "Supporting marker; not a score driver",
  duplicate_contribution_group: "Another marker represents this contribution group",
  not_in_contribution_group: "Not part of a score contribution group",
  score_not_available: "Score unavailable until readiness is complete",
  system_not_scoreable: "This body system is factual-only",
};

function formatValue(item: Pick<ScoreContributor, "value" | "value_text" | "unit">): string {
  if (item.value != null && Number.isFinite(item.value)) {
    return `${item.value} ${item.unit}`.trim();
  }
  return item.value_text?.trim() || "Value unavailable";
}

function formatReference(item: Pick<ScoreContributor, "ref_low" | "ref_high">): string {
  if (item.ref_low != null && item.ref_high != null) return `${item.ref_low}–${item.ref_high}`;
  if (item.ref_low != null) return `≥ ${item.ref_low}`;
  if (item.ref_high != null) return `≤ ${item.ref_high}`;
  return "Not provided on document";
}

function sourceHref(
  item: Pick<ScoreContributor, "source" | "source_page" | "measurement_definition_key" | "observation_id">,
  systemId: BodySystemId,
  navigationReturnTo?: string | null,
): string | null {
  if (!item.source) return null;
  const path = buildHealthNavigationPath(`/app/documents/${item.source.id}`, {
    system: systemId === "general" ? null : systemId,
    measurement: item.measurement_definition_key,
    observation: item.observation_id,
    returnTo: navigationReturnTo,
  });
  if (item.source_page == null) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}page=${encodeURIComponent(String(item.source_page))}`;
}

function SourceEvidence({
  item,
  systemId,
  navigationReturnTo,
}: {
  item: Pick<ScoreContributor, "source" | "source_page" | "source_text" | "source_region" | "measurement_definition_key" | "observation_id">;
  systemId: BodySystemId;
  navigationReturnTo?: string | null;
}) {
  const href = sourceHref(item, systemId, navigationReturnTo);
  const exactRegion = sourceRegionCanRender(item.source_region, item.source_page);
  return (
    <div className="mt-2 space-y-1 text-xs text-slate-600">
      <p>
        {item.source
          ? `${item.source.original_filename}${item.source_page != null ? ` · Page ${item.source_page}` : ""}`
          : "Source document unavailable"}
        {exactRegion
          ? " · Exact source region"
          : item.source_page != null
            ? " · Page-only source evidence"
            : " · Source page unavailable"}
      </p>
      {item.source_text ? <p className="line-clamp-3">“{item.source_text}”</p> : null}
      {href ? (
        <Link
          href={href}
          className="inline-block font-medium text-teal-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
        >
          Open source document
        </Link>
      ) : null}
    </div>
  );
}

function ReadinessGroups({ provenance }: { provenance: SystemScoreProvenance }) {
  if (provenance.readiness_groups.length === 0) return null;
  return (
    <section className="mt-4">
      <h4 className="text-sm font-semibold text-slate-900">Readiness groups</h4>
      <ul className="mt-2 space-y-2 text-sm">
        {provenance.readiness_groups.map((group) => (
          <li key={group.keys.join("|")} className="rounded-lg border border-slate-200 p-2">
            <div className="flex items-start justify-between gap-2">
              <span>{group.keys.join(" or ")}</span>
              <span className="shrink-0 text-xs font-medium text-slate-600">
                {group.status === "satisfied"
                  ? "Ready"
                  : group.status === "present_without_reference"
                    ? "Reference needed"
                    : "Missing"}
              </span>
            </div>
            {group.satisfied_by ? (
              <p className="mt-1 text-xs text-slate-500">Satisfied by {group.satisfied_by}</p>
            ) : null}
            {group.present_without_reference.length > 0 ? (
              <p className="mt-1 text-xs text-slate-500">
                Present without usable range: {group.present_without_reference.join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ContributorList({
  contributors,
  systemId,
  navigationReturnTo,
}: {
  contributors: ScoreContributor[];
  systemId: BodySystemId;
  navigationReturnTo?: string | null;
}) {
  return (
    <section className="mt-4">
      <h4 className="text-sm font-semibold text-slate-900">Contributors</h4>
      {contributors.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No observations contributed to a numeric score.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {contributors.map((contributor) => (
            <li
              key={`${contributor.observation_id ?? contributor.key}-${contributor.contribution_group}`}
              className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-slate-900">{contributor.name}</p>
                <p className="shrink-0 font-semibold tabular-nums text-emerald-800">
                  {contributor.contribution_score}/100
                </p>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Used for {contributor.contribution_group} · {formatValue(contributor)} · Document range {formatReference(contributor)}
              </p>
              <SourceEvidence
                item={contributor}
                systemId={systemId}
                navigationReturnTo={navigationReturnTo}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ExclusionList({
  excluded,
  systemId,
  navigationReturnTo,
  heading = "Excluded observations",
}: {
  excluded: ScoreExclusion[];
  systemId: BodySystemId;
  navigationReturnTo?: string | null;
  heading?: string;
}) {
  return (
    <section className="mt-4">
      <h4 className="text-sm font-semibold text-slate-900">{heading}</h4>
      {excluded.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No other observations were available for this score.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {excluded.map((item) => (
            <li
              key={`${item.observation_id ?? item.key}-${item.reason}-${item.observed_at}`}
              className="rounded-lg border border-slate-200 p-3 text-sm"
            >
              <p className="font-medium text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-600">
                {EXCLUSION_LABELS[item.reason]}
                {item.reason_detail ? ` · ${item.reason_detail}` : ""}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {formatValue(item)} · Observed {item.observed_at}
              </p>
              <SourceEvidence
                item={item}
                systemId={item.system_id ?? systemId}
                navigationReturnTo={navigationReturnTo}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ScoreProvenancePanel({
  systemId,
  stateScore,
  provenance,
  navigationReturnTo,
}: {
  systemId: BodySystemId;
  stateScore: number | null;
  provenance?: SystemScoreProvenance | null;
  navigationReturnTo?: string | null;
}) {
  if (!provenance) return null;
  return (
    <details className="rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
        How this assessment was calculated
      </summary>
      <div className="border-t border-slate-200 px-4 py-4">
        <p className="text-xs text-slate-600">
          Algorithm version: <code className="rounded bg-slate-100 px-1 py-0.5">{provenance.algorithm_version}</code>
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {stateScore == null
            ? "No numeric score is available from the current readiness evidence."
            : `The score is ${stateScore}/100 from the contributors below.`}
        </p>
        <ReadinessGroups provenance={provenance} />
        <ContributorList
          contributors={provenance.contributors}
          systemId={systemId}
          navigationReturnTo={navigationReturnTo}
        />
        <ExclusionList
          excluded={provenance.excluded}
          systemId={systemId}
          navigationReturnTo={navigationReturnTo}
        />
      </div>
    </details>
  );
}

export function ExcludedObservationsPanel({
  provenance,
  navigationReturnTo,
}: {
  provenance?: HealthProfileScoreProvenance | null;
  navigationReturnTo?: string | null;
}) {
  if (!provenance || provenance.excluded_observations.length === 0) return null;
  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600">
        Observations not used in a score ({provenance.excluded_observations.length})
      </summary>
      <p className="mt-2 text-sm text-slate-600">
        These results remain factual records. They were not used for a current-state score for the reason shown.
      </p>
      <ExclusionList
        excluded={provenance.excluded_observations}
        systemId="general"
        navigationReturnTo={navigationReturnTo}
        heading="Exclusion details"
      />
    </details>
  );
}
