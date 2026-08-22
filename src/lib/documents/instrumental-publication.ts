/**
 * PR2 (make-instrumental-publication-atomic) shared contracts.
 *
 * Canonicalization v2 makes the database authoritative for the snapshot
 * hash: `prepare_instrumental_publication` rebuilds the canonical JSONB and
 * rejects a mismatched caller digest. This module mirrors PostgreSQL's
 * `jsonb::text` serialization (key ordering, member separators, string
 * escaping) so the worker can compute the same digest ahead of the call.
 * Golden fixtures in the database test suite prove both sides agree.
 */
import { createHash } from "node:crypto";
import type { InstrumentalMeasureMaterializationInput } from "./instrumental-measure-lineage";

export const INSTRUMENTAL_CANONICALIZATION_VERSION =
  "eh105.instrumental-snapshot.v2";

export type InstrumentalSnapshotFinding = {
  finding_text: string;
  source_page: number | null;
  source_text: string | null;
  confidence: number | null;
};

export type InstrumentalSnapshotInput = {
  study_date: string | null;
  modality: string | null;
  body_region: string | null;
  facility_name: string | null;
  impression: string | null;
  processing_version: string | null;
  extraction_model: string | null;
  measures: InstrumentalMeasureMaterializationInput[];
  findings: InstrumentalSnapshotFinding[];
};

export type ClaimDocumentProcessingJobRow = {
  job_id: string;
  document_id: string;
  profile_id: string;
  attempts: number;
  max_attempts: number;
  processing_attempt_id: string;
  attempt_number: number;
  captured_write_generation: number;
};

export type PrepareInstrumentalPublicationArgs = {
  p_document_id: string;
  p_job_id: string;
  p_processing_attempt_id: string;
  p_snapshot: InstrumentalSnapshotInput;
  p_caller_digest: string | null;
};

export type PrepareInstrumentalPublicationRow = {
  publication_id: string;
  snapshot_content_id: string;
  canonicalization_version: string;
  snapshot_hash: string;
  content_reused: boolean;
  publication_reused: boolean;
};

export type InstrumentalPublicationCompletion = {
  page_count: number;
  thumbnail_storage_path: string;
  content_sha256: string;
  ocr_status: string;
  extraction_status: string;
  detected_document_type: string | null;
  type_mismatch_warning: boolean;
  type_mismatch_reason: string | null;
};

export type FinalizeInstrumentalPublicationArgs = {
  p_document_id: string;
  p_job_id: string;
  p_processing_attempt_id: string;
  p_publication_id: string;
  p_snapshot_content_id: string;
  p_canonicalization_version: string;
  p_snapshot_hash: string;
  p_summary_text: string | null;
  p_completion: InstrumentalPublicationCompletion;
};

export type FinalizeInstrumentalPublicationRow = {
  publication_id: string;
  write_generation: number;
  was_replayed: boolean;
};

type CanonicalJson =
  | string
  | number
  | boolean
  | null
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

/**
 * PostgreSQL renders `numeric` without exponent notation while
 * `JSON.stringify` switches to exponents outside [1e-6, 1e21). Reject those
 * values up front so the transported JSON literal and the jsonb rendering
 * stay byte-identical.
 */
export function assertCanonicalNumber(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Instrumental snapshot field ${field} must be finite`);
  }
  if (!/^-?\d+(\.\d+)?$/.test(String(value))) {
    throw new Error(
      `Instrumental snapshot field ${field} is outside the canonical non-exponent numeric range`
    );
  }
}

function utf8Compare(a: string, b: string): number {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return Buffer.compare(left, right);
}

/** jsonb object-key order: shorter keys first, then byte-wise comparison. */
function jsonbKeyCompare(a: string, b: string): number {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return left.length - right.length;
  return Buffer.compare(left, right);
}

/** Mirrors PostgreSQL escape_json: shortcuts for \b \f \n \r \t, \uXXXX otherwise. */
function escapeJsonString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20) out += `\\u${code.toString(16).padStart(4, "0")}`;
    else out += ch;
  }
  return out + '"';
}

/** Renders a value the way `jsonb::text` does. */
export function jsonbCanonicalText(value: CanonicalJson): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    assertCanonicalNumber(value, "canonical");
    return String(value);
  }
  if (typeof value === "string") return escapeJsonString(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => jsonbCanonicalText(item)).join(", ")}]`;
  }
  const keys = Object.keys(value).sort(jsonbKeyCompare);
  const members = keys.map(
    (key) => `${escapeJsonString(key)}: ${jsonbCanonicalText(value[key])}`
  );
  return `{${members.join(", ")}}`;
}

function normalizedOrNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function requireNormalized(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`Instrumental snapshot field ${field} must be non-empty`);
  }
  return trimmed;
}

/**
 * Normalizes extraction output into the exact shape the prepare RPC accepts:
 * btrim-normalized strings, explicit nulls, canonical-range numbers. The RPC
 * rejects (rather than re-normalizes) anything else, so this is the single
 * normalization point.
 */
export function normalizeInstrumentalSnapshot(input: {
  study_date: string | null;
  modality: string | null;
  body_region: string | null;
  facility_name: string | null;
  impression: string | null;
  processing_version: string | null;
  extraction_model: string | null;
  measures: InstrumentalMeasureMaterializationInput[];
  findings: InstrumentalSnapshotFinding[];
}): InstrumentalSnapshotInput {
  if (input.study_date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(input.study_date)) {
    throw new Error("Instrumental snapshot day projection must be YYYY-MM-DD or null");
  }

  const occurrences = new Set<string>();
  const measures = input.measures.map((measure) => {
    assertCanonicalNumber(measure.value, "measure.value");
    if (measure.confidence !== null) {
      assertCanonicalNumber(measure.confidence, "measure.confidence");
      if (measure.confidence < 0 || measure.confidence > 1) {
        throw new Error("Instrumental measure confidence must be within [0, 1]");
      }
    }
    if (
      measure.source_page !== null &&
      (!Number.isInteger(measure.source_page) || measure.source_page < 1)
    ) {
      throw new Error("Instrumental measure source_page must be a positive integer");
    }
    if (!Number.isInteger(measure.occurrence_index) || measure.occurrence_index < 0) {
      throw new Error("Instrumental measure has an invalid occurrence discriminator");
    }
    const normalized: InstrumentalMeasureMaterializationInput = {
      key_hint: normalizedOrNull(measure.key_hint),
      name: requireNormalized(measure.name, "measure.name"),
      raw_name: requireNormalized(measure.raw_name, "measure.raw_name"),
      value: measure.value,
      raw_value_text: requireNormalized(measure.raw_value_text, "measure.raw_value_text"),
      unit: measure.unit.trim(),
      raw_unit: measure.raw_unit.trim(),
      source_page: measure.source_page,
      source_text: normalizedOrNull(measure.source_text),
      source_locator: requireNormalized(measure.source_locator, "measure.source_locator"),
      occurrence_index: measure.occurrence_index,
      bounding_box: measure.bounding_box,
      confidence: measure.confidence,
    };
    const occurrenceKey = `${normalized.source_locator}\u0000${normalized.occurrence_index}`;
    if (occurrences.has(occurrenceKey)) {
      throw new Error("Instrumental extraction contains duplicate source locator occurrences");
    }
    occurrences.add(occurrenceKey);
    return normalized;
  });

  const findings = input.findings.map((finding) => {
    if (
      finding.source_page !== null &&
      (!Number.isInteger(finding.source_page) || finding.source_page < 1)
    ) {
      throw new Error("Instrumental finding source_page must be a positive integer");
    }
    if (finding.confidence !== null) {
      assertCanonicalNumber(finding.confidence, "finding.confidence");
      if (finding.confidence < 0 || finding.confidence > 1) {
        throw new Error("Instrumental finding confidence must be within [0, 1]");
      }
    }
    return {
      finding_text: requireNormalized(finding.finding_text, "finding.finding_text"),
      source_page: finding.source_page,
      source_text: normalizedOrNull(finding.source_text),
      confidence: finding.confidence,
    };
  });

  return {
    study_date: input.study_date,
    modality: normalizedOrNull(input.modality),
    body_region: normalizedOrNull(input.body_region),
    facility_name: normalizedOrNull(input.facility_name),
    impression: normalizedOrNull(input.impression),
    processing_version: normalizedOrNull(input.processing_version),
    extraction_model: normalizedOrNull(input.extraction_model),
    measures,
    findings,
  };
}

function compareNullableNumber(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1; // nulls first
  if (b === null) return 1;
  return a - b;
}

function compareNullableCText(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return -1; // nulls first
  if (b === null) return 1;
  return utf8Compare(a, b);
}

/**
 * Builds the canonical v2 value tree exactly as
 * `pr2_canonical_instrumental_snapshot` does: measures ordered by source
 * locator ("C" collation) and occurrence, findings ordered by their full
 * field tuple, every optional field an explicit null.
 */
export function canonicalInstrumentalSnapshot(
  snapshot: InstrumentalSnapshotInput
): CanonicalJson {
  const measures = [...snapshot.measures]
    .sort(
      (left, right) =>
        utf8Compare(left.source_locator, right.source_locator) ||
        left.occurrence_index - right.occurrence_index
    )
    .map((measure) => ({
      key_hint: measure.key_hint,
      name: measure.name,
      raw_name: measure.raw_name,
      value: measure.value,
      raw_value_text: measure.raw_value_text,
      unit: measure.unit,
      raw_unit: measure.raw_unit,
      source_page: measure.source_page,
      source_text: measure.source_text,
      source_locator: measure.source_locator,
      occurrence_index: measure.occurrence_index,
      bounding_box: (measure.bounding_box as CanonicalJson) ?? null,
      confidence: measure.confidence,
    }));

  const findings = [...snapshot.findings]
    .sort(
      (left, right) =>
        utf8Compare(left.finding_text, right.finding_text) ||
        compareNullableNumber(left.source_page, right.source_page) ||
        compareNullableCText(left.source_text, right.source_text) ||
        compareNullableCText(
          left.confidence === null ? null : String(left.confidence),
          right.confidence === null ? null : String(right.confidence)
        )
    )
    .map((finding) => ({
      finding_text: finding.finding_text,
      source_page: finding.source_page,
      source_text: finding.source_text,
      confidence: finding.confidence,
    }));

  return {
    schema: INSTRUMENTAL_CANONICALIZATION_VERSION,
    study_date: snapshot.study_date,
    modality: snapshot.modality,
    body_region: snapshot.body_region,
    facility_name: snapshot.facility_name,
    impression: snapshot.impression,
    processing_version: snapshot.processing_version,
    extraction_model: snapshot.extraction_model,
    measures,
    findings,
  };
}

/** Worker-side digest of the canonical v2 payload; the database re-verifies. */
export function instrumentalSnapshotDigest(
  snapshot: InstrumentalSnapshotInput
): string {
  return createHash("sha256")
    .update(Buffer.from(jsonbCanonicalText(canonicalInstrumentalSnapshot(snapshot)), "utf8"))
    .digest("hex");
}
