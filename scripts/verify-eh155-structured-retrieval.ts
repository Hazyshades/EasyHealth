import assert from "node:assert/strict";
import type { DocumentStructuredContext } from "../src/lib/documents/structured-context";

async function main(): Promise<void> {
  // The retrieval module imports server environment validation; fixtures run without secrets.
  process.env.SKIP_ENV_VALIDATION = "1";
  const {
    parseStructuredQueryIntent,
    projectStructuredAssistantSources,
  } = await import("../src/lib/assistant/structured-retrieval");

  const context: DocumentStructuredContext = {
    biomarkers: [
      {
        source_row_id: "obs-1",
        document_id: "doc-1",
        biomarker: "Glucose",
        analyte_key: "glucose",
        measurement_definition_key: "glucose.serum",
        resolution_status: "resolved",
        verification_status: "verified",
        decision_source: "persisted",
        decision_quality: "available",
        decision_not_persisted: false,
        decision_quality_codes: [],
        registry_binding_ready: true,
        structured_context_eligible: true,
        value: 5.4,
        value_kind: "numeric",
        value_text: "5.4",
        unit: "mmol/L",
        ref_low: 3.9,
        ref_high: 5.5,
        observed_at: "2026-01-14",
        source: "lab.pdf",
      },
    ],
    instrumental_findings: [],
    consultation_notes: [
      {
        source_row_id: "note-1",
        document_id: "doc-2",
        filename: "consultation.pdf",
        document_type: "consultation_note",
        note_kind: "consultation",
        provider_name: null,
        visit_date: "2025-12-01",
        document_observed_at: "2025-12-01",
        chief_complaint: "Follow-up",
        history_summary: "Stable",
        exam_findings: null,
        documented_problems: [],
        recommendations: [],
        follow_up_plan: null,
        summary: "Follow-up note",
      },
    ],
    discharge_summaries: [],
    prescriptions: [],
    referrals: [],
    document_summaries: [],
    source_document_ids: ["doc-1", "doc-2"],
  };

  const sources = projectStructuredAssistantSources("profile-1", context);
  assert.equal(sources.length, 2);
  assert.equal(sources[0]?.source_kind, "verified_structured");
  assert.match(sources[0]?.source_id ?? "", /^asrc_[0-9a-f]{32}$/u);
  assert.equal(sources[0]?.profile_id, "profile-1");
  assert.equal(sources[0]?.document_id, "doc-1");
  assert.match(sources[0]?.excerpt ?? "", /Glucose/iu);
  assert.match(sources[0]?.href ?? "", /doc-1/u);

  const intent = parseStructuredQueryIntent("What was my glucose result in the lab document?");
  assert.deepEqual(intent.terms, ["glucose", "result", "lab", "document"]);
  assert.equal(intent.asksForMeasurements, true);
  assert.equal(intent.asksForDocuments, true);

  console.log("EH-155 structured retrieval verification passed");
}

void main();
