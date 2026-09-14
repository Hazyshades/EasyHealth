import assert from "node:assert/strict";
import type {
  MeasurementResolution,
  ResolverDecisionTrace,
} from "../src/lib/biomarkers";
import type { PanelSpecimenPolicy } from "../src/lib/biomarkers/panel-specimen-policy";
import type { DeployedRegistryRelease } from "../src/lib/registry-reprocessing/types";
import type {
  BaseMeasurement,
  MeasurementOverride,
} from "../src/lib/documents/observation-measurement-correction";
import type { MeasurementEvidenceSource } from "../src/lib/documents/measurement-evidence-admission";
import type { NormalizationRevision } from "../src/lib/documents/normalization-revisions";
import type { ExtractedBiomarkerWriterRow } from "../src/lib/documents/observation-normalization-writer";

/**
 * These runtime imports follow dummy environment initialization because the
 * application module graph eagerly validates Supabase configuration.
 */
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "verify-eh248-dummy";
process.env.OPENAI_API_KEY ??= "verify-eh248-dummy";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://verify-eh248.example";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "verify-eh248-dummy";

async function main(): Promise<void> {
  const { resolveMeasurementDefinition } = await import(
    "../src/lib/biomarkers"
  );
  const { baseMeasurementFromExtractedRow } = await import(
    "../src/lib/documents/observation-measurement-correction"
  );
  const { prepareMeasurementEvidence } = await import(
    "../src/lib/documents/measurement-evidence-admission"
  );
  const {
    buildPreparedEvidenceIdentity,
    MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
  } = await import("../src/lib/documents/measurement-evidence-identity");
  const { preparedEvidenceFromExtracted } = await import(
    "../src/lib/documents/normalization-review"
  );
  const { preparedEvidenceFromWriterRow } = await import(
    "../src/lib/documents/observation-normalization-writer"
  );
  const {
    buildInputEvidenceHash,
    restoreBatchVerificationRevision,
  } = await import("../src/lib/documents/normalization-revisions");
  const { computeReprocessBatchDiff } = await import(
    "../src/lib/registry-reprocessing/diff"
  );
  const { captureDeployedRelease } = await import(
    "../src/lib/registry-reprocessing/release"
  );
  const { runRegistryV2CandidateCorpusTechnical } = await import(
    "./lib/registry-v2-candidate-corpus"
  );

  const restoreRpcCalls: unknown[] = [];
  const restoredBatch = await restoreBatchVerificationRevision(
    {
      batchRevisionId: "batch-revision-id",
      actorId: "actor-id",
      correctionReason: "undo synthetic batch",
    },
    async (params) => {
      restoreRpcCalls.push(params);
      return {
        data: [
          {
            observation_id: "observation-id",
            revision_id: "reversal-id",
            was_reused: false,
          },
        ],
        error: null,
      };
    },
  );
  assert.equal(restoredBatch.revisionId, "reversal-id");
  assert.equal(restoredBatch.wasReused, false);
  assert.equal(restoreRpcCalls.length, 1);
  const restoreRpcCall = restoreRpcCalls[0] as Record<string, string>;
  assert.equal(restoreRpcCall.p_batch_revision_id, "batch-revision-id");
  assert.equal(restoreRpcCall.p_actor_id, "actor-id");
  assert.equal(restoreRpcCall.p_correction_reason, "undo synthetic batch");
  assert.match(restoreRpcCall.p_request_hash, /^[a-f0-9]{64}$/);

  type SourceOverrides = Partial<MeasurementEvidenceSource>;

  function measurement(
    valueText: string,
    value: number | null,
    valueKind: BaseMeasurement["valueKind"] = "numeric",
    unit = "g/L",
  ): BaseMeasurement {
    return {
      value,
      valueText,
      valueKind,
      ordinal: null,
      unit,
      refLow: null,
      refHigh: null,
      observedAt: null,
    };
  }

  function source(overrides: SourceOverrides = {}): MeasurementEvidenceSource {
    return {
      baseMeasurement: measurement("138", 138),
      rawLabel: "Hemoglobin (HGB)",
      rawUnit: "g/L",
      rawValueText: "138",
      sourceText: "Hemoglobin (HGB) 138 g/L",
      sectionContext: null,
      sourceAnalyteKey: "hemoglobin",
      proposedKey: "hemoglobin",
      specimen: null,
      modifier: null,
      timing: null,
      method: null,
      ...overrides,
    };
  }

  function policy(
    key: string,
    specimen: PanelSpecimenPolicy["specimen"],
    maturity: PanelSpecimenPolicy["maturity"] = "reviewed",
  ): PanelSpecimenPolicy {
    return {
      key,
      displayName: key,
      headingForms: ["CBC"],
      specimen,
      appliesToAnalytes: ["hemoglobin"],
      maturity,
      sourceProvenance: {
        kind: "registry_v2_review",
        sourceRecordKey: `eh248-test:${key}`,
      },
      reviewReference: "issue-248-test",
    };
  }

  function writerRow(
    overrides: Partial<ExtractedBiomarkerWriterRow> = {},
  ): ExtractedBiomarkerWriterRow {
    return {
      id: "eh248-writer-row",
      biomarker_key: "hemoglobin",
      biomarker_name: "Hemoglobin",
      raw_name: "Hemoglobin (HGB)",
      value_numeric: 138,
      value_text: "138",
      value_kind: "numeric",
      ordinal: null,
      unit: "g/L",
      raw_unit: "g/L",
      reference_range: null,
      raw_reference_range: null,
      section_context: "CBC",
      confidence: 0.91,
      specimen: null,
      modifier: null,
      source_page: 1,
      source_text: "Hemoglobin (HGB) 138 g/L",
      bounding_box: null,
      reported_alt_value: null,
      reported_alt_unit: null,
      raw_value_text: "138",
      method: null,
      processing_version: "eh248-test",
      ...overrides,
    };
  }

  function activeRevision(options: {
    row: ExtractedBiomarkerWriterRow;
    inputEvidenceHash: string;
    inputIdentityFormatVersion: string | null;
    release: DeployedRegistryRelease;
    resolution: MeasurementResolution;
    verificationStatus?: NormalizationRevision["verification_status"];
  }): NormalizationRevision {
    return {
      id: "eh248-active-revision",
      extracted_biomarker_id: options.row.id,
      input_evidence_hash: options.inputEvidenceHash,
      input_identity_format_version: options.inputIdentityFormatVersion,
      observation_id: "eh248-observation",
      measurement_definition_key: options.resolution.measurementDefinitionKey,
      analyte_key: options.resolution.analyteKey,
      resolver_result: options.resolution.result,
      mapping_confidence: options.resolution.mappingConfidence,
      mapping_confidence_band: options.resolution.mappingConfidenceBand,
      verification_status: options.verificationStatus ?? "auto_verified",
      verification_decided_at: null,
      verification_actor_type: null,
      verification_actor_id: null,
      is_active: true,
      mapping_change_classification: "compatibility_preserving",
      resolver_evidence: options.resolution
        .decisionTrace as ResolverDecisionTrace,
      catalog_manifest_version: options.release.catalogManifestVersion,
      catalog_manifest_digest: options.release.catalogManifestDigest,
      resolver_version: options.release.resolverVersion,
      normalization_version: options.release.normalizationVersion,
      measurement_override: null,
    };
  }

  function assertNoPolicySpecimen(resolution: MeasurementResolution): void {
    assert.equal(
      resolution.candidateEvidence.some((candidate) =>
        candidate.accepted.some(
          (evidence) => evidence.code === "specimen_from_reviewed_panel",
        ),
      ),
      false,
    );
  }

  // ── Admission order, sentinels and policy ownership ─────────────────────────
  const overridden = prepareMeasurementEvidence(
    source({
      baseMeasurement: measurement("5.1", 5.1, "numeric", "mmol/L"),
      rawLabel: "Glucose",
      rawUnit: "mg/dL",
      rawValueText: "5.1",
      sourceText: "Glucose 5.1 mmol/L",
      sourceAnalyteKey: "glucose",
      proposedKey: "glucose",
      override: {
        value: 6.2,
        value_text: "6.2",
        value_kind: "numeric",
        unit: "mmol/L",
      } satisfies MeasurementOverride,
    }),
  );
  assert.equal(overridden.effectiveMeasurement.value, 6.2);
  assert.equal(overridden.effectiveMeasurement.valueText, "6.2");
  assert.equal(overridden.input.rawValueText, "5.1");
  assert.equal(overridden.input.rawUnit, "mmol/L");
  assert.equal(
    buildPreparedEvidenceIdentity(overridden).record.rawUnit,
    "mg/dL",
  );
  assert.equal(overridden.input.specimen, null);
  assert.equal(overridden.panelSpecimenPolicy.status, "no_match");

  const sentinel = prepareMeasurementEvidence(
    source({ specimen: "unknown", sourceText: "Hemoglobin (HGB) 138 g/L" }),
  );
  assert.equal(sentinel.input.specimen, null);
  assert.equal(sentinel.panelSpecimenPolicy.status, "no_match");

  const stated = prepareMeasurementEvidence(
    source({
      sectionContext: "CBC",
      sourceText: "Hemoglobin (HGB), whole blood 138 g/L",
      specimen: "whole_blood",
    }),
  );
  assert.deepEqual(stated.panelSpecimenPolicy, {
    status: "stated",
    policyKey: null,
    effectiveSpecimen: "whole_blood",
    sourceAnalyteKey: "hemoglobin",
    sourceProvenance: null,
    conflictPolicyKeys: [],
  });

  const applied = prepareMeasurementEvidence(
    source({
      sectionContext: "Complete blood count",
      sourceText: "Hemoglobin (HGB) 138 g/L",
      laboratory: "northern-diagnostics",
    }),
  );
  assert.equal(applied.panelSpecimenPolicy.status, "applied");
  assert.equal(applied.panelSpecimenPolicy.policyKey, "cbc_whole_blood");
  assert.equal(applied.input.specimen, "whole_blood");
  assert.equal(applied.input.specimenSource, "reviewed_panel_policy");
  assert.equal(applied.input.laboratory, "northern-diagnostics");
  assert.equal(
    buildPreparedEvidenceIdentity(applied).record.laboratory,
    "northern-diagnostics",
  );
  const provisionalPolicy = prepareMeasurementEvidence(
    source({
      sectionContext: "CBC",
      panelSpecimenPolicies: [
        policy("provisional_policy", "whole_blood", "provisional"),
      ],
    }),
  );
  assert.equal(
    provisionalPolicy.panelSpecimenPolicy.status,
    "no_match",
    "provisional policy matches are not admitted as Resolver evidence",
  );

  const excludedGlucose = prepareMeasurementEvidence(
    source({
      rawLabel: "Glucose",
      sourceAnalyteKey: "glucose",
      proposedKey: "glucose",
      sectionContext: "CBC",
      sourceText: "Glucose 5.1 mmol/L",
      baseMeasurement: measurement("5.1", 5.1, "numeric", "mmol/L"),
    }),
  );
  assert.equal(excludedGlucose.panelSpecimenPolicy.status, "no_match");
  assert.equal(excludedGlucose.input.specimen, null);
  assertNoPolicySpecimen(resolveMeasurementDefinition(excludedGlucose.input));

  const conflict = prepareMeasurementEvidence(
    source({
      sectionContext: "CBC",
      panelSpecimenPolicies: [
        policy("z_policy", "whole_blood"),
        policy("a_policy", "serum"),
      ],
    }),
  );
  assert.equal(conflict.panelSpecimenPolicy.status, "conflict");
  assert.deepEqual(conflict.panelSpecimenPolicy.conflictPolicyKeys, [
    "a_policy",
    "z_policy",
  ]);
  assert.equal(conflict.input.specimen, null);
  const conflictResolution = resolveMeasurementDefinition(conflict.input);
  assert.equal(conflictResolution.result, "partial");
  assert.equal(conflictResolution.measurementDefinitionKey, null);
  assert.deepEqual(conflictResolution.candidateKeys, []);
  assert.ok(
    conflictResolution.reasons.includes("panel_specimen_policy_conflict"),
  );
  assert.ok(
    conflictResolution.candidateEvidence.some((candidate) =>
      candidate.rejected.some(
        (evidence) => evidence.code === "panel_specimen_policy_conflict",
      ),
    ),
  );

  const deduped = prepareMeasurementEvidence(
    source({
      sectionContext: "CBC",
      panelSpecimenPolicies: [
        policy("same_policy", "whole_blood"),
        policy("same_policy", "whole_blood"),
      ],
    }),
  );
  assert.equal(deduped.panelSpecimenPolicy.status, "applied");
  assert.deepEqual(deduped.panelSpecimenPolicy.conflictPolicyKeys, []);
  assert.equal(deduped.panelSpecimenPolicy.policyKey, "same_policy");

  // ── Canonical identity and comparator preservation ──────────────────────────
  const equivalentHeadingA = prepareMeasurementEvidence(
    source({ sectionContext: "Complete blood count" }),
  );
  const equivalentHeadingB = prepareMeasurementEvidence(
    source({ sectionContext: "CBC" }),
  );
  assert.equal(
    buildPreparedEvidenceIdentity(equivalentHeadingA).hash,
    buildPreparedEvidenceIdentity(equivalentHeadingB).hash,
    "equivalent policy headings share the prepared identity",
  );
  assert.notEqual(
    buildPreparedEvidenceIdentity(stated).hash,
    buildPreparedEvidenceIdentity(applied).hash,
    "stated and policy-derived specimens remain distinct",
  );

  const nullOmitted = prepareMeasurementEvidence(
    source({ specimen: undefined, modifier: undefined }),
  );
  const nullExplicit = prepareMeasurementEvidence(
    source({ specimen: null, modifier: null }),
  );
  assert.equal(
    buildPreparedEvidenceIdentity(nullOmitted).hash,
    buildPreparedEvidenceIdentity(nullExplicit).hash,
    "omitted and explicit null axes are canonicalized equally",
  );
  const reorderedNeighbours = prepareMeasurementEvidence(
    source({ neighbourLabels: ["Beta", "Alpha", "Alpha"] }),
  );
  const sortedNeighbours = prepareMeasurementEvidence(
    source({ neighbourLabels: ["Alpha", "Beta"] }),
  );
  assert.equal(
    buildPreparedEvidenceIdentity(reorderedNeighbours).hash,
    buildPreparedEvidenceIdentity(sortedNeighbours).hash,
    "neighbour collections are sorted and deduplicated",
  );
  const sourceTextChanged = prepareMeasurementEvidence(
    source({ sourceText: "OCR copy differs", sectionContext: "CBC" }),
  );
  assert.equal(
    buildPreparedEvidenceIdentity(sourceTextChanged).hash,
    buildPreparedEvidenceIdentity(equivalentHeadingB).hash,
    "raw source/OCR text is excluded from Resolver input identity",
  );
  assert.equal(MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION, "1");

  const comparatorBase = baseMeasurementFromExtractedRow(
    {
      value_numeric: 0.2,
      value_text: "< 0.20",
      value_kind: "numeric",
      ordinal: null,
      unit: "mmol/L",
      reference_range: null,
      raw_reference_range: null,
      raw_value_text: "< 0.20",
    },
    null,
  );
  const comparator = prepareMeasurementEvidence(
    source({
      baseMeasurement: comparatorBase,
      rawLabel: "Free T4",
      rawUnit: "pmol/L",
      rawValueText: "< 0.20",
      sourceText: "Free T4 < 0.20 pmol/L",
      sourceAnalyteKey: "free_t4",
      proposedKey: "free_t4",
    }),
  );
  assert.equal(comparator.effectiveMeasurement.value, null);
  assert.equal(comparator.effectiveMeasurement.valueKind, "text");
  assert.equal(comparator.effectiveMeasurement.valueText, "< 0.20");
  const comparatorIdentity = buildPreparedEvidenceIdentity(comparator);
  assert.equal(comparatorIdentity.record.effectiveValue, null);
  assert.equal(comparatorIdentity.record.effectiveValueKind, "text");
  assert.equal(comparatorIdentity.record.effectiveValueText, "< 0.20");

  // ── Review/writer parity and candidate-corpus identity ───────────────────────
  const equivalentWriterRow = writerRow({
    section_context: "Complete blood count",
  });
  const reviewPrepared = preparedEvidenceFromExtracted(equivalentWriterRow);
  const writerPrepared = preparedEvidenceFromWriterRow(equivalentWriterRow);
  assert.deepEqual(reviewPrepared.input, writerPrepared.input);
  assert.equal(
    buildPreparedEvidenceIdentity(reviewPrepared).hash,
    buildPreparedEvidenceIdentity(writerPrepared).hash,
    "review and writer adapters share one prepared identity",
  );

  const technicalCorpus = runRegistryV2CandidateCorpusTechnical();
  const corpusHeading = technicalCorpus.report.rows.find(
    (row) => row.id === "hemoglobin-cbc-heading",
  );
  assert.ok(corpusHeading);
  const corpusEquivalentWriterRow = writerRow({
    section_context: "Complete blood count with manual smear microscopy + ESR",
  });
  const corpusWriterPrepared = preparedEvidenceFromWriterRow(
    corpusEquivalentWriterRow,
  );
  assert.equal(
    corpusHeading.preparedInputIdentityHash,
    buildPreparedEvidenceIdentity(corpusWriterPrepared).hash,
    "corpus identity matches the production writer adapter",
  );
  assert.equal(
    corpusHeading.preparedInputIdentityFormatVersion,
    MEASUREMENT_INPUT_IDENTITY_FORMAT_VERSION,
  );
  assert.deepEqual(
    corpusHeading.preparedEvidence,
    {
      specimen: "whole_blood",
      specimenSource: "reviewed_panel_policy",
      panelSpecimenPolicy: {
        status: "applied",
        policyKey: "cbc_whole_blood",
        sourceProvenance: {
          kind: "registry_v2_review",
          sourceRecordKey: "panel-specimen-policy:cbc_whole_blood",
        },
        conflictPolicyKeys: [],
      },
    },
    "corpus reports policy-derived specimen provenance separately from stated evidence",
  );
  assert.notEqual(
    corpusHeading.preparedInputIdentityHash,
    technicalCorpus.report.candidateInputHash,
  );
  assert.equal(
    technicalCorpus.manifest.candidateInputHash,
    technicalCorpus.report.candidateInputHash,
  );
  let mutationAttemptCalled = false;
  assert.throws(
    () =>
      runRegistryV2CandidateCorpusTechnical({
        mutationAttempt: () => {
          mutationAttemptCalled = true;
        },
      }),
    /rejects runtime mutation/,
  );
  assert.equal(mutationAttemptCalled, false);

  // ── Reprocessing facts and historical prior identity ------------------------
  const release = captureDeployedRelease();
  const reprocessRow = writerRow({
    id: "eh248-reprocess-row",
    section_context: "CBC",
  });
  const currentResolution = resolveMeasurementDefinition(
    preparedEvidenceFromWriterRow(reprocessRow).input,
  );
  const nextWithoutPrior = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: null,
    includeManualDecisions: false,
    release,
  });
  const exactActive = activeRevision({
    row: reprocessRow,
    inputEvidenceHash: nextWithoutPrior.next.inputEvidenceHash,
    inputIdentityFormatVersion: "1",
    release,
    resolution: currentResolution,
  });
  const historicalHash = "b".repeat(64);
  const changedInput = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: { ...exactActive, input_evidence_hash: historicalHash },
    includeManualDecisions: false,
    release,
  });
  assert.equal(changedInput.prior.inputEvidenceHash, historicalHash);
  assert.equal(
    changedInput.next.inputEvidenceHash,
    nextWithoutPrior.next.inputEvidenceHash,
  );
  assert.equal(changedInput.next.changeFacts.inputChange, "changed");
  assert.equal(changedInput.next.changeFacts.outcomeChange, "unchanged");
  assert.equal(changedInput.diffClassification, "identity_changed");
  assert.equal(changedInput.next.activateRevision, true);

  const legacy = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: { ...exactActive, input_identity_format_version: null },
    includeManualDecisions: false,
    release,
  });
  assert.equal(legacy.next.changeFacts.inputChange, "unavailable");
  assert.equal(legacy.diffClassification, "needs_review");
  assert.equal(legacy.next.activateRevision, false);
  const invalidHash = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: {
      ...exactActive,
      input_evidence_hash: "not-a-sha256-hash",
    },
    includeManualDecisions: false,
    release,
  });
  assert.equal(invalidHash.next.changeFacts.inputChange, "unavailable");
  assert.equal(invalidHash.diffClassification, "needs_review");
  assert.equal(invalidHash.next.activateRevision, false);

  const releaseChanged = {
    ...release,
    catalogManifestVersion: `${release.catalogManifestVersion}-refresh`,
    catalogManifestDigest: "a".repeat(64),
    resolverVersion: `${release.resolverVersion}-refresh`,
    normalizationVersion: `${release.normalizationVersion}-refresh`,
    compatibilityPolicyVersion: `${release.compatibilityPolicyVersion}-refresh`,
  };
  const releaseOnly = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: exactActive,
    includeManualDecisions: false,
    release: releaseChanged,
  });
  assert.equal(releaseOnly.next.changeFacts.inputChange, "unchanged");
  assert.equal(releaseOnly.next.changeFacts.outcomeChange, "unchanged");
  assert.equal(releaseOnly.next.changeFacts.releaseChange, "changed");
  assert.equal(releaseOnly.diffClassification, "unchanged");
  assert.equal(releaseOnly.next.createRevision, false);
  assert.equal(releaseOnly.next.activateRevision, false);
  assert.equal(
    releaseOnly.next.inputEvidenceHash,
    nextWithoutPrior.next.inputEvidenceHash,
    "release metadata changes do not change prepared input identity",
  );
  const explicitReleaseRefresh = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: exactActive,
    includeManualDecisions: false,
    release: releaseChanged,
    releaseRefresh: true,
  });
  assert.equal(explicitReleaseRefresh.diffClassification, "unchanged");
  assert.equal(
    explicitReleaseRefresh.diffReasonCode,
    "release_refresh_requested",
  );
  assert.equal(explicitReleaseRefresh.next.createRevision, true);
  assert.equal(explicitReleaseRefresh.next.activateRevision, true);

  const protectedDiff = computeReprocessBatchDiff({
    extractedRow: {
      ...reprocessRow,
      profile_id: "eh248-profile",
      document_id: "eh248-document",
      observation_kind: "lab",
    },
    activeRevision: {
      ...exactActive,
      input_evidence_hash: historicalHash,
      verification_status: "user_verified",
    },
    includeManualDecisions: false,
    release,
  });
  assert.equal(protectedDiff.diffClassification, "skipped_manual_decision");
  assert.equal(protectedDiff.next.changeFacts.createRevision, false);
  assert.equal(protectedDiff.next.changeFacts.activateRevision, false);

  assert.equal(
    buildInputEvidenceHash(writerPrepared),
    buildPreparedEvidenceIdentity(writerPrepared).hash,
    "persisted hash helper uses the same prepared identity",
  );

  process.stdout.write("EH-248 Resolver evidence identity verifier passed.\n");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
