import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DuplicateCandidate,
  DuplicateCandidateState,
  DuplicateDocumentSummary,
  DuplicateMatchKind,
  DuplicateReasonCode,
} from "@/lib/documents/duplicate-detection";

type CandidateRow = {
  id: string;
  left_document_id: string;
  right_document_id: string;
  match_kind: DuplicateMatchKind;
  similarity_score: number | string;
  reason_codes: string[] | null;
  state: DuplicateCandidateState;
  detected_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

const DOCUMENT_SUMMARY_SELECT =
  "id, original_filename, document_type, lab_name, observed_at, created_at, status, processing_status";

export async function getDuplicateCandidatesForDocument(
  profileId: string,
  documentId: string,
): Promise<DuplicateCandidate[]> {
  const supabase = createAdminClient();
  const [leftResult, rightResult] = await Promise.all([
    supabase
      .from("document_duplicate_candidates")
      .select(
        "id, left_document_id, right_document_id, match_kind, similarity_score, reason_codes, state, detected_at, updated_at, reviewed_at",
      )
      .eq("profile_id", profileId)
      .eq("left_document_id", documentId)
      .eq("state", "pending"),
    supabase
      .from("document_duplicate_candidates")
      .select(
        "id, left_document_id, right_document_id, match_kind, similarity_score, reason_codes, state, detected_at, updated_at, reviewed_at",
      )
      .eq("profile_id", profileId)
      .eq("right_document_id", documentId)
      .eq("state", "pending"),
  ]);

  if (leftResult.error) throw new Error(leftResult.error.message);
  if (rightResult.error) throw new Error(rightResult.error.message);

  const candidates = new Map<string, CandidateRow>();
  for (const row of [...(leftResult.data ?? []), ...(rightResult.data ?? [])]) {
    candidates.set(row.id, row as CandidateRow);
  }

  if (candidates.size === 0) return [];

  const candidateRows = [...candidates.values()];
  const documentIds = [
    ...new Set(
      candidateRows.flatMap((candidate) => [
        candidate.left_document_id,
        candidate.right_document_id,
      ]),
    ),
  ];
  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select(DOCUMENT_SUMMARY_SELECT)
    .eq("profile_id", profileId)
    .is("archived_at", null)
    .in("id", documentIds);

  if (documentsError) throw new Error(documentsError.message);

  const summaries = new Map<string, DuplicateDocumentSummary>(
    (documents ?? []).map((document) => [
      document.id,
      document as DuplicateDocumentSummary,
    ]),
  );

  return candidateRows.flatMap((candidate) => {
    const leftDocument = summaries.get(candidate.left_document_id);
    const rightDocument = summaries.get(candidate.right_document_id);
    if (!leftDocument || !rightDocument) return [];

    return [
      {
        id: candidate.id,
        left_document_id: candidate.left_document_id,
        right_document_id: candidate.right_document_id,
        match_kind: candidate.match_kind,
        similarity_score: Number(candidate.similarity_score),
        reason_codes: (candidate.reason_codes ?? []) as DuplicateReasonCode[],
        state: candidate.state,
        detected_at: candidate.detected_at,
        updated_at: candidate.updated_at,
        reviewed_at: candidate.reviewed_at,
        left_document: leftDocument,
        right_document: rightDocument,
      },
    ];
  });
}
