export type DocumentCompletionWriter = {
  /**
   * One guarded database transaction (complete_document_processing_attempt)
   * that applies document completion fields, completes the job and attempt,
   * and invalidates health synthesis. Instrumental documents never use this
   * path: their completion is owned by finalize_instrumental_publication.
   */
  complete: () => Promise<void>;
  writeFailure: (message: string) => Promise<void>;
};

export async function finalizeDocumentProcessing(
  writer: DocumentCompletionWriter
): Promise<"completed" | "failed"> {
  try {
    await writer.complete();
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document completion failed";
    await writer.writeFailure(message);
    return "failed";
  }
}
