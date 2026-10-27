import assert from "node:assert/strict";
import { validateAssistantEvidence } from "../src/lib/assistant/evidence";
import type { AssistantModelResponse, AssistantSource } from "../src/lib/assistant/contract";

const source: AssistantSource = {
  source_id: "asrc_00000000000000000000000000000001",
  source_kind: "verified_structured",
  source_row_id: "obs-1",
  document_id: "doc-1",
  document_type: "lab_result",
  filename: "lab.pdf",
  page_number: null,
  observed_at: "2026-01-14",
  label: "Glucose result",
  excerpt: "Glucose: 5.4 mmol/L. Recorded 2026-01-14.",
  href: "/app/documents/doc-1",
  profile_id: "profile-1",
};

const supported: AssistantModelResponse = {
  answer: "Your recorded glucose result was 5.4 mmol/L.",
  claims: [
    {
      id: "glucose-1",
      kind: "personal",
      text: "Your recorded glucose result was 5.4 mmol/L.",
      source_ids: [source.source_id],
    },
  ],
};
const supportedResult = validateAssistantEvidence({
  profileId: "profile-1",
  mode: "personal_facts",
  modelResponse: supported,
  sources: [source],
});
assert.equal(supportedResult.answer, supported.answer);
assert.equal(supportedResult.citations.length, 1);
assert.equal(supportedResult.coverage.supported_claims, 1);
assert.equal(supportedResult.coverage.rejected_claims, 0);

const unknownSource = validateAssistantEvidence({
  profileId: "profile-1",
  mode: "personal_facts",
  modelResponse: {
    answer: "Your result was normal.",
    claims: [
      {
        id: "unknown-1",
        kind: "personal",
        text: "Your result was normal.",
        source_ids: ["asrc_00000000000000000000000000000002"],
      },
    ],
  },
  sources: [source],
});
assert.match(unknownSource.answer, /does not support a complete personal answer/i);
assert.deepEqual(unknownSource.limitationCodes, ["UNSUPPORTED_CLAIM"]);
assert.equal(unknownSource.coverage.rejected_claims, 1);

const crossProfileSource = validateAssistantEvidence({
  profileId: "profile-1",
  mode: "personal_facts",
  modelResponse: {
    answer: "The result belongs to this profile.",
    claims: [
      {
        id: "cross-profile-1",
        kind: "personal",
        text: "The result belongs to this profile.",
        source_ids: [source.source_id],
      },
    ],
  },
  sources: [{ ...source, profile_id: "profile-2" }],
});
assert.deepEqual(crossProfileSource.limitationCodes, ["UNSUPPORTED_CLAIM"]);
assert.equal(crossProfileSource.citations.length, 0);

const education = validateAssistantEvidence({
  profileId: "profile-1",
  mode: "general_education",
  modelResponse: {
    answer: "HbA1c estimates average blood glucose over a longer period.",
    claims: [{ id: "general-1", kind: "general", text: "HbA1c estimates average blood glucose over a longer period.", source_ids: [] }],
  },
  sources: [],
  initialLimitations: ["GENERAL_INFORMATION"],
});
assert.equal(education.answer.startsWith("HbA1c"), true);
assert.deepEqual(education.limitationCodes, ["GENERAL_INFORMATION"]);

console.log("EH-158 assistant evidence verification passed");
