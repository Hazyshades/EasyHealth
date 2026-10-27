import { ASSISTANT_DISCLAIMER, type AssistantResponse, type AssistantSource } from "@/lib/assistant/contract";

export function buildSyntheticAssistantExample(profileId: string, requestId: string): AssistantResponse {
  const source: AssistantSource = {
    source_id: "asrc_11111111111111111111111111111111",
    source_kind: "synthetic_example",
    source_row_id: "synthetic-beta-example",
    document_id: null,
    document_type: "synthetic_example",
    filename: "Synthetic beta example",
    page_number: null,
    observed_at: "2026-01-01",
    label: "Synthetic example result",
    excerpt: "Synthetic example only: this value is not a real health record.",
    href: null,
    profile_id: profileId,
  };
  return {
    request_id: requestId,
    mode: "general_education",
    answer:
      "This is a synthetic example. In a real answer, each personal statement would link to an eligible record source.",
    citations: [
      {
        source_id: source.source_id,
        source_kind: source.source_kind,
        document_id: null,
        label: source.label,
        page_number: null,
        observed_at: source.observed_at,
        href: null,
      },
    ],
    limitations: ["GENERAL_INFORMATION"],
    coverage: {
      personal_claims: 0,
      supported_claims: 0,
      rejected_claims: 0,
      structured_sources: 0,
      semantic_sources: 0,
    },
    safety: {
      disclaimer: ASSISTANT_DISCLAIMER,
      clinician_boundary: true,
    },
  };
}
