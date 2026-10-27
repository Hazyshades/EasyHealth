import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AssistantFilters,
  AssistantLimitationCode,
  AssistantSource,
} from "@/lib/assistant/contract";
import {
  embedAssistantDocuments,
  embedAssistantQuery,
} from "@/lib/assistant/embeddings";
import {
  chunkAssistantDocumentPages,
  hashAssistantSourcePages,
  type AssistantDocumentPage,
} from "@/lib/assistant/semantic-chunking";

export type AssistantReindexJob = Readonly<{
  id: string;
  profile_id: string;
  document_id: string;
  requested_content_sha256: string;
  requested_write_generation: number;
}>;

export type SemanticRetrievalResult = Readonly<{
  sources: readonly AssistantSource[];
  limitationCodes: readonly AssistantLimitationCode[];
  inputTokens: number;
  provider: string | null;
  modelId: string | null;
}>;

type DocumentIndexSnapshot = Readonly<{
  id: string;
  profile_id: string;
  lifecycle_state: string | null;
  upload_state: string | null;
  processing_status: string | null;
  status: string;
  write_generation: number;
  pages: readonly AssistantDocumentPage[];
  sourceHash: string;
}>;

type SemanticMatchRow = {
  chunk_id: string;
  profile_id: string;
  document_id: string;
  page_number: number;
  chunk_index: number;
  section_context: string | null;
  content: string;
  content_sha256: string;
  similarity: number;
  original_filename: string;
  document_type: string;
  observed_at: string | null;
};

function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

function chunkSourceId(chunkId: string, documentId: string): string {
  const digest = createHash("sha256")
    .update(`accepted_document_text:${chunkId}:${documentId}`)
    .digest("hex")
    .slice(0, 32);
  return `asrc_${digest}`;
}

function sourceHref(documentId: string, pageNumber: number): string {
  return `/app/documents/${encodeURIComponent(documentId)}?page=${pageNumber}`;
}

function pageNumber(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : 1;
}

async function readIndexSnapshot(
  profileId: string,
  documentId: string,
): Promise<DocumentIndexSnapshot | null> {
  const supabase = createAdminClient();
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, profile_id, lifecycle_state, upload_state, processing_status, status, write_generation",
    )
    .eq("id", documentId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (documentError) throw new Error(documentError.message);
  if (!document) return null;
  if (document.lifecycle_state !== "active" || document.upload_state !== "complete") {
    return null;
  }
  const processed =
    document.processing_status === "ready" ||
    document.processing_status === "needs_review" ||
    document.status === "completed";
  if (!processed) return null;

  const { data: pages, error: pagesError } = await supabase
    .from("document_pages")
    .select("id, page_number, ocr_text")
    .eq("document_id", documentId)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .order("page_number", { ascending: true });
  if (pagesError) throw new Error(pagesError.message);
  const normalizedPages = (pages ?? []).map((page) => ({
    id: String(page.id),
    page_number: pageNumber(page.page_number),
    ocr_text: typeof page.ocr_text === "string" ? page.ocr_text : null,
    section_context: null,
  }));
  return {
    id: String(document.id),
    profile_id: String(document.profile_id),
    lifecycle_state: document.lifecycle_state,
    upload_state: document.upload_state,
    processing_status: document.processing_status,
    status: String(document.status),
    write_generation: Number(document.write_generation ?? 0),
    pages: normalizedPages,
    sourceHash: hashAssistantSourcePages(normalizedPages),
  };
}

export async function queueAssistantReindexJob(input: {
  profileId: string;
  documentId: string;
  requestedContentSha256: string;
  requestedWriteGeneration: number;
}): Promise<AssistantReindexJob> {
  const supabase = createAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("assistant_reindex_jobs")
    .select(
      "id, profile_id, document_id, requested_content_sha256, requested_write_generation",
    )
    .eq("profile_id", input.profileId)
    .eq("document_id", input.documentId)
    .in("status", ["queued", "processing"])
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return existing as AssistantReindexJob;

  const { data, error } = await supabase
    .from("assistant_reindex_jobs")
    .insert({
      profile_id: input.profileId,
      document_id: input.documentId,
      requested_content_sha256: input.requestedContentSha256,
      requested_write_generation: input.requestedWriteGeneration,
      status: "queued",
    })
    .select(
      "id, profile_id, document_id, requested_content_sha256, requested_write_generation",
    )
    .single();
  if (error) throw new Error(error.message);
  return data as AssistantReindexJob;
}

export async function indexAssistantDocument(
  job: AssistantReindexJob,
): Promise<{ chunks: number; inputTokens: number }> {
  const snapshot = await readIndexSnapshot(job.profile_id, job.document_id);
  if (!snapshot) throw new Error("assistant_reindex_source_unavailable");
  if (
    snapshot.sourceHash !== job.requested_content_sha256 ||
    snapshot.write_generation !== job.requested_write_generation
  ) {
    throw new Error("assistant_reindex_source_stale");
  }
  const chunks = chunkAssistantDocumentPages(snapshot.pages);
  const embeddings = await embedAssistantDocuments(chunks.map((chunk) => chunk.content));
  if (embeddings.embeddings.length !== chunks.length) {
    throw new Error("assistant_embedding_count_mismatch");
  }

  const supabase = createAdminClient();
  const { error: deleteError } = await supabase
    .from("assistant_document_chunks")
    .delete()
    .eq("profile_id", job.profile_id)
    .eq("document_id", job.document_id);
  if (deleteError) throw new Error(deleteError.message);

  if (chunks.length > 0) {
    const rows = chunks.map((chunk, index) => ({
      profile_id: job.profile_id,
      document_id: job.document_id,
      document_page_id: chunk.document_page_id,
      page_number: chunk.page_number,
      chunk_index: chunk.chunk_index,
      section_context: chunk.section_context,
      content: chunk.content,
      content_sha256: chunk.content_sha256,
      embedding: vectorLiteral(embeddings.embeddings[index] ?? []),
      embedding_provider: embeddings.provider,
      embedding_model: embeddings.modelId,
      source_write_generation: job.requested_write_generation,
      is_current: true,
    }));
    const { error: insertError } = await supabase
      .from("assistant_document_chunks")
      .insert(rows);
    if (insertError) throw new Error(insertError.message);
  }
  return { chunks: chunks.length, inputTokens: embeddings.inputTokens };
}

function mapSemanticSource(row: SemanticMatchRow): AssistantSource {
  return {
    source_id: chunkSourceId(row.chunk_id, row.document_id),
    source_kind: "accepted_document_text",
    source_row_id: row.chunk_id,
    document_id: row.document_id,
    document_type: row.document_type,
    filename: row.original_filename || "Health document",
    page_number: pageNumber(row.page_number),
    observed_at: row.observed_at,
    label: `${row.original_filename || "Health document"}, page ${pageNumber(row.page_number)}`,
    excerpt: row.content.slice(0, 1_600),
    href: sourceHref(row.document_id, pageNumber(row.page_number)),
    profile_id: row.profile_id,
  };
}

export async function retrieveSemanticAssistantSources(input: {
  profileId: string;
  question: string;
  filters?: AssistantFilters;
  matchCount?: number;
}): Promise<SemanticRetrievalResult> {
  try {
    const embedding = await embedAssistantQuery(input.question);
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("match_assistant_document_chunks", {
      p_profile_id: input.profileId,
      p_query_embedding: vectorLiteral(embedding.embeddings[0] ?? []),
      p_match_count: Math.min(Math.max(input.matchCount ?? 8, 1), 24),
      p_min_similarity: 0.72,
      p_document_ids: input.filters?.document_ids ?? null,
      p_document_types: input.filters?.document_types ?? null,
      p_start_date: input.filters?.start_date ?? null,
      p_end_date: input.filters?.end_date ?? null,
    });
    if (error) throw new Error(error.message);
    return {
      sources: ((data ?? []) as SemanticMatchRow[]).map(mapSemanticSource),
      limitationCodes: [],
      inputTokens: embedding.inputTokens,
      provider: embedding.provider,
      modelId: embedding.modelId,
    };
  } catch {
    return {
      sources: [],
      limitationCodes: ["SEMANTIC_RETRIEVAL_UNAVAILABLE"],
      inputTokens: 0,
      provider: null,
      modelId: null,
    };
  }
}

export async function getAssistantReindexSnapshot(
  profileId: string,
  documentId: string,
): Promise<Readonly<{ contentSha256: string; writeGeneration: number }> | null> {
  const snapshot = await readIndexSnapshot(profileId, documentId);
  if (!snapshot) return null;
  return {
    contentSha256: snapshot.sourceHash,
    writeGeneration: snapshot.write_generation,
  };
}
