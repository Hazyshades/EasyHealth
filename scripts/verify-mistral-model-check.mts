const { workerEnv } = await import("../worker/src/env");
const {
  formatMistralModelCheckEvidence,
} = await import("../worker/src/ocr/model-check");
const { verifyMistralOcrModel } = await import("../worker/src/ocr/mistral");
const { OcrProviderError } = await import("../worker/src/ocr/types");

try {
  const evidence = await verifyMistralOcrModel();
  console.log(formatMistralModelCheckEvidence(evidence));
} catch (error) {
  const errorCode = error instanceof OcrProviderError
    ? error.code
    : "mistral_model_check_evidence_unavailable";
  console.error(JSON.stringify({
    event: "mistral_models_list_check",
    provider: "mistral",
    region: workerEnv.mistralOcrRegion,
    requested_model: workerEnv.mistralOcrModel,
    model_present: false,
    success: false,
    error_code: errorCode,
    checked_at_utc: new Date().toISOString(),
  }));
  process.exitCode = 1;
}
