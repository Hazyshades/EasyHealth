/**
 * EH-121: the read model over `observation_change_events`.
 *
 * The ledger stores identifiers, enum state, hashes and versions. This module
 * turns one ledger row into an entry a reviewer or a support engineer can read:
 * a headline, the axes that actually moved, who moved them, why, and the
 * processing contract in force at the time.
 *
 * Pure by construction so it is covered by `scripts/verify-eh121-*.ts` without
 * a test runner and reusable on both the server and the client.
 */

import type {
  MappingConfidenceBand,
  ResolverResult,
  VerificationStatus,
} from "@/lib/biomarkers";
import {
  isResolverResult,
  resolverOutcomeVariant,
  verificationStatusLabel,
  verificationStatusVariant,
  type ReviewChipVariant,
} from "./observation-review-workspace";

export type ObservationChangeEventKind =
  | "observation_accepted"
  | "mapping_corrected"
  | "correction_reverted"
  | "verification_changed"
  | "extraction_superseded"
  | "reprocess_applied";

export type ObservationChangeEventOrigin = "capture" | "backfill";

export type ObservationChangeActorType = "user" | "system";

/** The ledger row as PostgREST returns it. */
export type ObservationChangeEventRow = Readonly<{
  id: string;
  event_kind: string;
  origin: string;
  observation_id: string | null;
  extracted_biomarker_id: string | null;
  source_revision_id: string | null;
  source_prior_revision_id: string | null;
  source_reprocess_row_id: string | null;
  actor_type: string;
  actor_id: string | null;
  correction_reason: string | null;
  prior_measurement_definition_key: string | null;
  prior_analyte_key: string | null;
  prior_resolver_result: string | null;
  prior_verification_status: string | null;
  prior_mapping_confidence_band: string | null;
  prior_input_evidence_hash: string | null;
  next_measurement_definition_key: string | null;
  next_analyte_key: string | null;
  next_resolver_result: string | null;
  next_verification_status: string | null;
  next_mapping_confidence_band: string | null;
  next_input_evidence_hash: string | null;
  next_mapping_change_classification: string | null;
  catalog_manifest_version: string | null;
  catalog_manifest_digest: string | null;
  resolver_version: string | null;
  normalization_version: string | null;
  extraction_version: string | null;
  occurred_at: string;
  created_at: string;
}>;

export type ObservationChangeField =
  | "measurement"
  | "analyte"
  | "outcome"
  | "verification"
  | "confidence";

export type ObservationChangeFieldDiff = Readonly<{
  field: ObservationChangeField;
  label: string;
  from: string | null;
  to: string | null;
}>;

export type ObservationChangeVersions = Readonly<{
  catalogManifestVersion: string | null;
  catalogManifestDigest: string | null;
  resolverVersion: string | null;
  normalizationVersion: string | null;
  extractionVersion: string | null;
}>;

export type ObservationChangeEntry = Readonly<{
  id: string;
  kind: ObservationChangeEventKind;
  origin: ObservationChangeEventOrigin;
  /** True when the entry was reconstructed by the EH-121 backfill. */
  reconstructed: boolean;
  observationId: string | null;
  extractedBiomarkerId: string | null;
  revisionId: string | null;
  priorRevisionId: string | null;
  headline: string;
  variant: ReviewChipVariant;
  actorType: ObservationChangeActorType;
  actorId: string | null;
  actorLabel: string;
  reason: string | null;
  fields: readonly ObservationChangeFieldDiff[];
  /**
   * Evidence is referenced, never reproduced: these are the input-evidence
   * hashes of the revisions on either side of the change, for support to
   * correlate against the revision store.
   */
  priorEvidenceHash: string | null;
  nextEvidenceHash: string | null;
  versions: ObservationChangeVersions;
  occurredAt: string;
  createdAt: string;
}>;

const EVENT_KINDS: Readonly<Record<ObservationChangeEventKind, true>> = {
  observation_accepted: true,
  mapping_corrected: true,
  correction_reverted: true,
  verification_changed: true,
  extraction_superseded: true,
  reprocess_applied: true,
};

const EVENT_HEADLINES: Readonly<Record<ObservationChangeEventKind, string>> = {
  observation_accepted: "Result accepted",
  mapping_corrected: "Measurement mapping corrected",
  correction_reverted: "Correction reverted",
  verification_changed: "Verification updated",
  extraction_superseded: "Source extraction replaced by reprocessing",
  reprocess_applied: "Catalog reprocessing applied",
};

const EVENT_VARIANTS: Readonly<
  Record<ObservationChangeEventKind, ReviewChipVariant>
> = {
  observation_accepted: "success",
  mapping_corrected: "info",
  correction_reverted: "warning",
  verification_changed: "info",
  extraction_superseded: "neutral",
  reprocess_applied: "info",
};

const FIELD_LABELS: Readonly<Record<ObservationChangeField, string>> = {
  measurement: "Measurement",
  analyte: "Analyte",
  outcome: "Recognition outcome",
  verification: "Verification",
  confidence: "Mapping confidence",
};

const CONFIDENCE_LABELS: Readonly<Record<MappingConfidenceBand, string>> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const VERIFICATION_STATUSES: Readonly<Record<VerificationStatus, true>> = {
  pending: true,
  auto_verified: true,
  user_verified: true,
  manually_corrected: true,
};

const OUTCOME_LABELS: Readonly<Record<ResolverResult, string>> = {
  resolved: "Recognized",
  partial: "Partly recognized",
  ambiguous: "Ambiguous",
  unmapped: "Not recognized",
};

export function isObservationChangeEventKind(
  value: unknown,
): value is ObservationChangeEventKind {
  return typeof value === "string" && value in EVENT_KINDS;
}

function asVerificationStatus(value: unknown): VerificationStatus | null {
  if (typeof value !== "string") return null;
  return value in VERIFICATION_STATUSES ? (value as VerificationStatus) : null;
}

function asConfidenceBand(value: unknown): MappingConfidenceBand | null {
  if (typeof value !== "string") return null;
  return value in CONFIDENCE_LABELS ? (value as MappingConfidenceBand) : null;
}

function diff(
  field: ObservationChangeField,
  from: string | null,
  to: string | null,
): ObservationChangeFieldDiff | null {
  if (from === to) return null;
  if (from === null && to === null) return null;
  return { field, label: FIELD_LABELS[field], from, to };
}

/**
 * Every event carries the full diff regardless of its kind, so a correction
 * that also moved verification shows both axes in one entry instead of being
 * split across two rows with the same timestamp.
 */
function buildFieldDiffs(
  row: ObservationChangeEventRow,
): readonly ObservationChangeFieldDiff[] {
  const priorOutcome = row.prior_resolver_result;
  const nextOutcome = row.next_resolver_result;
  const priorVerification = asVerificationStatus(row.prior_verification_status);
  const nextVerification = asVerificationStatus(row.next_verification_status);
  const priorBand = asConfidenceBand(row.prior_mapping_confidence_band);
  const nextBand = asConfidenceBand(row.next_mapping_confidence_band);

  const candidates = [
    diff(
      "measurement",
      row.prior_measurement_definition_key,
      row.next_measurement_definition_key,
    ),
    diff("analyte", row.prior_analyte_key, row.next_analyte_key),
    diff(
      "outcome",
      isResolverResult(priorOutcome) ? OUTCOME_LABELS[priorOutcome] : null,
      isResolverResult(nextOutcome) ? OUTCOME_LABELS[nextOutcome] : null,
    ),
    diff(
      "verification",
      priorVerification ? verificationStatusLabel(priorVerification) : null,
      nextVerification ? verificationStatusLabel(nextVerification) : null,
    ),
    diff(
      "confidence",
      priorBand ? CONFIDENCE_LABELS[priorBand] : null,
      nextBand ? CONFIDENCE_LABELS[nextBand] : null,
    ),
  ];
  return candidates.filter(
    (entry): entry is ObservationChangeFieldDiff => entry !== null,
  );
}

/**
 * The chip variant follows the axis a reader cares about most: a verification
 * change is coloured by the verification state it reached, a recognition change
 * by the outcome it reached, and everything else by its kind.
 */
function entryVariant(
  kind: ObservationChangeEventKind,
  row: ObservationChangeEventRow,
): ReviewChipVariant {
  if (kind === "verification_changed") {
    return verificationStatusVariant(
      asVerificationStatus(row.next_verification_status),
    );
  }
  if (kind === "reprocess_applied" && isResolverResult(row.next_resolver_result)) {
    return resolverOutcomeVariant(row.next_resolver_result);
  }
  return EVENT_VARIANTS[kind];
}

export type ObservationChangeEntryOptions = Readonly<{
  /** Used to tell the reader's own actions from someone else's. */
  viewerProfileId?: string | null;
}>;

const ACTOR_LABELS = {
  system: "Automatic",
  self: "You",
  other: "Another reviewer",
} as const;

export function buildObservationChangeEntry(
  row: ObservationChangeEventRow,
  options: ObservationChangeEntryOptions = {},
): ObservationChangeEntry | null {
  if (!isObservationChangeEventKind(row.event_kind)) return null;

  const kind = row.event_kind;
  const origin: ObservationChangeEventOrigin =
    row.origin === "backfill" ? "backfill" : "capture";
  const actorType: ObservationChangeActorType =
    row.actor_type === "user" && row.actor_id ? "user" : "system";
  const actorId = actorType === "user" ? row.actor_id : null;
  const reason = row.correction_reason?.trim();
  const actorLabel =
    actorType === "system"
      ? ACTOR_LABELS.system
      : actorId && actorId === options.viewerProfileId
        ? ACTOR_LABELS.self
        : ACTOR_LABELS.other;

  return {
    id: row.id,
    kind,
    origin,
    reconstructed: origin === "backfill",
    observationId: row.observation_id,
    extractedBiomarkerId: row.extracted_biomarker_id,
    revisionId: row.source_revision_id,
    priorRevisionId: row.source_prior_revision_id,
    headline: EVENT_HEADLINES[kind],
    variant: entryVariant(kind, row),
    actorType,
    actorId,
    actorLabel,
    reason: reason ? reason : null,
    fields: buildFieldDiffs(row),
    priorEvidenceHash: row.prior_input_evidence_hash,
    nextEvidenceHash: row.next_input_evidence_hash,
    versions: {
      catalogManifestVersion: row.catalog_manifest_version,
      catalogManifestDigest: row.catalog_manifest_digest,
      resolverVersion: row.resolver_version,
      normalizationVersion: row.normalization_version,
      extractionVersion: row.extraction_version,
    },
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

/** Newest first, with `created_at` breaking ties on identical timestamps. */
export function buildObservationChangeEntries(
  rows: readonly ObservationChangeEventRow[],
  options: ObservationChangeEntryOptions = {},
): readonly ObservationChangeEntry[] {
  return rows
    .map((row) => buildObservationChangeEntry(row, options))
    .filter((entry): entry is ObservationChangeEntry => entry !== null)
    .sort((left, right) => {
      const byOccurred = right.occurredAt.localeCompare(left.occurredAt);
      if (byOccurred !== 0) return byOccurred;
      return right.createdAt.localeCompare(left.createdAt);
    });
}

/**
 * The review workspace renders many rows at once and fetches the document's
 * history in one request, so it needs the entries keyed by the two identities a
 * review row can have.
 */
export function indexObservationChangeEntries(
  entries: readonly ObservationChangeEntry[],
): ReadonlyMap<string, readonly ObservationChangeEntry[]> {
  const index = new Map<string, ObservationChangeEntry[]>();
  const push = (key: string | null, entry: ObservationChangeEntry) => {
    if (!key) return;
    const bucket = index.get(key);
    if (bucket) {
      bucket.push(entry);
      return;
    }
    index.set(key, [entry]);
  };
  for (const entry of entries) {
    push(entry.observationId, entry);
    push(entry.extractedBiomarkerId, entry);
  }
  return index;
}
