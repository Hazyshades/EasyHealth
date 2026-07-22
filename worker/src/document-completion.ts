export type DocumentCompletionWriter = {
  writeDocumentCompletion: () => Promise<void>;
  invalidateHealthSynthesis: () => Promise<void>;
  writeJobCompletion: () => Promise<void>;
  writeFailure: (message: string) => Promise<void>;
};

export async function finalizeDocumentProcessing(
  writer: DocumentCompletionWriter
): Promise<"completed" | "failed"> {
  try {
    await writer.writeDocumentCompletion();
    await writer.invalidateHealthSynthesis();
    await writer.writeJobCompletion();
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document completion failed";
    await writer.writeFailure(message);
    return "failed";
  }
}
