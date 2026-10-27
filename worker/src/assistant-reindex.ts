import { createOpenAI } from "@ai-sdk/openai";
import { embedMany } from "ai";
import {
  chunkAssistantDocumentPages,
  hashAssistantSourcePages,
  type AssistantDocumentPage,
} from "../../src/lib/assistant/semantic-chunking.js";
import { workerEnv } from "./env.js";
import { supabase } from "./supabase.js";

type ReindexJob = {
  id: string;
  profile_id: string;
  document_id: string;
  requested_content_sha256: string;
  requested_write_generation: number;
};

type DocumentRow = {
  id: string;
  profile_id: string;
  lifecycle_state: string | null;
  upload_state: string | null;
  processing_status: string | null;
  status: string;
  write_generation: number | null;
};

function safeErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("timeout"))
    return "assistant_embedding_provider_unavailable";
  if (message.includes("embedding"))
    return "assistant_embedding_provider_unavailable";
  if (message.includes("stale")) return "assistant_reindex_source_stale";
  return "assistant_reindex_failed";
}

function vectorLiteral(vector: readonly number[]): string {
  return `[${vector.join(",")}]`;
}

function claimRows(data: unknown): ReindexJob | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as ReindexJob) : null;
}

async function claimJob(): Promise<ReindexJob | null> {
  const { data, error } = await supabase.rpc("claim_assistant_reindex_job");
  if (error)
    throw new Error(`assistant reindex claim failed: ${error.message}`);
  return claimRows(data);
}

async function markStale(job: ReindexJob): Promise<void> {
  const { error } = await supabase.rpc("mark_assistant_reindex_job_stale", {
    p_job_id: job.id,
  });
  if (error)
    throw new Error(`assistant reindex stale update failed: ${error.message}`);
}

async function complete(job: ReindexJob): Promise<void> {
  const { error } = await supabase.rpc("complete_assistant_reindex_job", {
    p_job_id: job.id,
  });
  if (error)
    throw new Error(`assistant reindex completion failed: ${error.message}`);
}

async function fail(job: ReindexJob, code: string): Promise<void> {
  const { error } = await supabase.rpc("fail_assistant_reindex_job", {
    p_job_id: job.id,
    p_error_code: code,
  });
  if (error)
    console.error("Assistant reindex failure update failed:", error.message);
}

async function readDocument(
  job: ReindexJob,
): Promise<{ document: DocumentRow; pages: AssistantDocumentPage[] } | null> {
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, profile_id, lifecycle_state, upload_state, processing_status, status, write_generation",
    )
    .eq("id", job.document_id)
    .eq("profile_id", job.profile_id)
    .maybeSingle();
  if (documentError) throw new Error(documentError.message);
  if (!document) return null;
  const row = document as DocumentRow;
  const processed =
    row.processing_status === "ready" ||
    row.processing_status === "needs_review" ||
    row.status === "completed";
  if (
    row.lifecycle_state !== "active" ||
    row.upload_state !== "complete" ||
    !processed
  ) {
    return null;
  }

  const { data: pages, error: pagesError } = await supabase
    .from("document_pages")
    .select("id, page_number, ocr_text")
    .eq("document_id", job.document_id)
    .eq("profile_id", job.profile_id)
    .eq("is_current", true)
    .order("page_number", { ascending: true });
  if (pagesError) throw new Error(pagesError.message);
  return {
    document: row,
    pages: (pages ?? []).map((page) => ({
      id: String(page.id),
      page_number: Number(page.page_number),
      ocr_text: typeof page.ocr_text === "string" ? page.ocr_text : null,
    })),
  };
}

async function writeChunks(
  job: ReindexJob,
  pages: readonly AssistantDocumentPage[],
): Promise<{
  chunks: number;
  inputTokens: number;
  modelId: string;
  latencyMs: number;
}> {
  const started = Date.now();
  const chunks = chunkAssistantDocumentPages(pages);
  const embeddingModel = createOpenAI({
    apiKey: workerEnv.openaiApiKey,
  }).embedding(workerEnv.openaiEmbeddingModel);
  const embeddings =
    chunks.length === 0
      ? { embeddings: [], usage: { tokens: 0 } }
      : await embedMany({
          model: embeddingModel,
          values: chunks.map((chunk) => chunk.content),
          maxParallelCalls: 4,
          maxRetries: 1,
        });
  if (embeddings.embeddings.length !== chunks.length) {
    throw new Error("assistant_embedding_count_mismatch");
  }
  const rows = chunks.map((chunk, index) => ({
    document_page_id: chunk.document_page_id,
    page_number: chunk.page_number,
    chunk_index: chunk.chunk_index,
    section_context: chunk.section_context,
    content: chunk.content,
    content_sha256: chunk.content_sha256,
    embedding: vectorLiteral(embeddings.embeddings[index] ?? []),
  }));
  const { data: publication, error: publicationError } = await supabase.rpc(
    "publish_assistant_reindex_chunks",
    {
      p_job_id: job.id,
      p_profile_id: job.profile_id,
      p_document_id: job.document_id,
      p_requested_content_sha256: job.requested_content_sha256,
      p_requested_write_generation: job.requested_write_generation,
      p_chunks: rows,
      p_embedding_provider: "openai",
      p_embedding_model: workerEnv.openaiEmbeddingModel,
    },
  );
  if (publicationError) {
    throw new Error(
      `assistant_reindex_publish_failed: ${publicationError.message}`,
    );
  }
  const publicationRow = (
    Array.isArray(publication) ? publication[0] : publication
  ) as { status?: string; chunk_count?: number } | null;
  if (publicationRow?.status !== "published") {
    throw new Error("assistant_reindex_source_stale");
  }
  return {
    chunks: Number(publicationRow.chunk_count ?? 0),
    inputTokens: embeddings.usage.tokens,
    modelId: workerEnv.openaiEmbeddingModel,
    latencyMs: Date.now() - started,
  };
}

async function logEmbedding(
  job: ReindexJob,
  inputTokens: number,
  modelId: string,
  latencyMs: number,
): Promise<void> {
  const { error } = await supabase.from("ai_invocations").insert({
    profile_id: job.profile_id,
    document_id: job.document_id,
    stage: "assistant_embedding",
    provider: "openai",
    model_id: modelId,
    latency_ms: latencyMs,
    input_tokens: inputTokens,
    output_tokens: null,
    success: true,
    error_code: null,
    provider_switch: false,
  });
  if (error)
    console.error("Assistant embedding telemetry failed:", error.message);
}

export async function queueAssistantReindexJob(
  profileId: string,
  documentId: string,
): Promise<boolean> {
  const { data: document, error: documentError } = await supabase
    .from("documents")
    .select(
      "id, profile_id, lifecycle_state, upload_state, processing_status, status, write_generation",
    )
    .eq("id", documentId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (documentError)
    throw new Error(
      `assistant reindex document read failed: ${documentError.message}`,
    );
  if (!document) return false;
  const row = document as DocumentRow;
  const processed =
    row.processing_status === "ready" ||
    row.processing_status === "needs_review" ||
    row.status === "completed";
  if (
    row.lifecycle_state !== "active" ||
    row.upload_state !== "complete" ||
    !processed
  ) {
    return false;
  }

  const { data: pages, error: pagesError } = await supabase
    .from("document_pages")
    .select("id, page_number, ocr_text")
    .eq("document_id", documentId)
    .eq("profile_id", profileId)
    .eq("is_current", true)
    .order("page_number", { ascending: true });
  if (pagesError)
    throw new Error(
      `assistant reindex pages read failed: ${pagesError.message}`,
    );
  const sourcePages = (pages ?? []).map((page) => ({
    id: String(page.id),
    page_number: Number(page.page_number),
    ocr_text: typeof page.ocr_text === "string" ? page.ocr_text : null,
  }));
  const requestedContentSha256 = hashAssistantSourcePages(sourcePages);
  const requestedWriteGeneration = Number(row.write_generation ?? 0);

  const { data: activeJob, error: activeJobError } = await supabase
    .from("assistant_reindex_jobs")
    .select("id")
    .eq("profile_id", profileId)
    .eq("document_id", documentId)
    .in("status", ["queued", "processing"])
    .maybeSingle();
  if (activeJobError)
    throw new Error(
      `assistant reindex active-job read failed: ${activeJobError.message}`,
    );
  if (activeJob) return false;

  const { error: insertError } = await supabase
    .from("assistant_reindex_jobs")
    .insert({
      profile_id: profileId,
      document_id: documentId,
      requested_content_sha256: requestedContentSha256,
      requested_write_generation: requestedWriteGeneration,
    });
  if (insertError) {
    if (insertError.code === "23505") return false;
    throw new Error(
      `assistant reindex job insert failed: ${insertError.message}`,
    );
  }
  return true;
}

export async function processOneAssistantReindexJob(): Promise<boolean> {
  const job = await claimJob();
  if (!job) return false;
  try {
    const source = await readDocument(job);
    if (!source) {
      await markStale(job);
      return true;
    }
    const sourceHash = hashAssistantSourcePages(source.pages);
    if (
      sourceHash !== job.requested_content_sha256 ||
      Number(source.document.write_generation ?? 0) !==
        Number(job.requested_write_generation)
    ) {
      await markStale(job);
      return true;
    }
    const result = await writeChunks(job, source.pages);
    await complete(job);
    await logEmbedding(
      job,
      result.inputTokens,
      result.modelId,
      result.latencyMs,
    );
    console.log(
      `Indexed ${result.chunks} assistant chunks for document ${job.document_id}`,
    );
  } catch (error) {
    const code = safeErrorCode(error);
    if (code === "assistant_reindex_source_stale") {
      await markStale(job);
    } else {
      await fail(job, code);
    }
    console.error(`Assistant reindex job ${job.id} failed: ${code}`);
  }
  return true;
}
