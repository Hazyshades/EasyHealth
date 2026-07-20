import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { E2ERunContext, E2EPrincipal, OwnedDocument } from "./ownership";
import { registerDocument, registerStoragePath } from "./ownership";
import { E2E_STORAGE_BUCKET, assertData, assertSupabaseOk } from "./supabase";

export type FixtureName =
  | "LAB-BASELINE"
  | "LAB-RESOLVED"
  | "LAB-PARTIAL"
  | "LAB-AMBIGUOUS"
  | "LAB-PROVENANCE"
  | "LAB-PROVENANCE-PARTIAL"
  | "LAB-NOT-RESOLVED"
  | "INST-NORMAL"
  | "INST-REPEAT"
  | "INST-FAILURE"
  | "SAFETY-LAB-PARTIAL"
  | "SAFETY-LAB-AMBIGUOUS";

export type FixtureDocument = OwnedDocument & {
  observedAt: string;
  sourceText: string;
};

type LabFixtureOptions = {
  fixture: FixtureName;
  principal: E2EPrincipal;
  observedAt: string;
  processingStatus?: "ready" | "needs_review";
  value: number;
  sourceText: string;
  rawName?: string;
  includeResolvedObservation?: boolean;
  extractedStatus?: "accepted" | "needs_review";
};

type InstrumentalFixtureOptions = {
  fixture: FixtureName;
  principal: E2EPrincipal;
  observedAt: string;
  processingStatus: "ready" | "failed";
  sourceText: string;
  findings: string[];
};

const SOURCE_ASSET = Buffer.from(
  readFileSync(join(process.cwd(), "e2e", "assets", "e2e-preview.png.base64"), "utf8").trim(),
  "base64",
);
const SOURCE_CONTENT_TYPE = "image/png";
const E2E_PROCESSING_VERSION = "e2e-fixture-v1";

export async function seedDeterministicFixtures(
  client: SupabaseClient,
  context: E2ERunContext,
): Promise<void> {
  const primary = requirePrincipal(context, "primary");
  const safety = requirePrincipal(context, "safety");

  await createLabFixture(client, context, {
    fixture: "LAB-BASELINE",
    principal: primary,
    observedAt: "2025-01-15",
    processingStatus: "ready",
    extractedStatus: "accepted",
    includeResolvedObservation: true,
    value: 5.2,
    sourceText: "E2E SYNTHETIC ONLY — LAB-BASELINE — Glucose 5.2 mmol/L; reference 3.9–5.5; page 1.",
  });
  await createLabFixture(client, context, {
    fixture: "LAB-RESOLVED",
    principal: primary,
    observedAt: "2025-02-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 5.4,
    sourceText: "E2E SYNTHETIC ONLY — LAB-RESOLVED — Glucose 5.4 mmol/L; reference 3.9–5.5; page 1.",
  });
  await createLabFixture(client, context, {
    fixture: "LAB-PARTIAL",
    principal: primary,
    observedAt: "2025-03-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 7.1,
    rawName: "E2E partial glucose source",
    sourceText: "E2E SYNTHETIC ONLY — LAB-PARTIAL — incomplete source context; 7.1 mmol/L; page 1.",
  });
  await createLabFixture(client, context, {
    fixture: "LAB-AMBIGUOUS",
    principal: primary,
    observedAt: "2025-04-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 7.3,
    rawName: "E2E ambiguous glucose source",
    sourceText: "E2E SYNTHETIC ONLY — LAB-AMBIGUOUS — source label remains ambiguous; 7.3 mmol/L; page 1.",
  });
  await createLabFixture(client, context, {
    fixture: "LAB-PROVENANCE",
    principal: primary,
    observedAt: "2025-05-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 5.6,
    sourceText: "E2E-PROVENANCE-SOURCE — Glucose 5.6 mmol/L (reference 3.9–5.5), printed on page 1.",
  });
  await createLabFixture(client, context, {
    fixture: "LAB-PROVENANCE-PARTIAL",
    principal: primary,
    observedAt: "2025-06-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 8.1,
    rawName: "E2E provenance partial source",
    sourceText: "E2E-PROVENANCE-PARTIAL-SOURCE — raw 8.1 mmol/L remains unverified on page 1.",
  });
  await createLabFixture(client, context, {
    fixture: "LAB-NOT-RESOLVED",
    principal: primary,
    observedAt: "2025-07-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 11.2,
    rawName: "E2E unrecognized laboratory source",
    sourceText: "E2E SYNTHETIC ONLY — LAB-NOT-RESOLVED — unrecognized raw source 11.2 units; page 1.",
  });
  await createInstrumentalFixture(client, context, {
    fixture: "INST-NORMAL",
    principal: primary,
    observedAt: "2025-08-15",
    processingStatus: "ready",
    sourceText: "E2E-INST-NORMAL-SOURCE — synthetic instrumental report on page 1.",
    findings: [
      "E2E normal finding: no focal synthetic abnormality.",
      "E2E normal finding: synthetic study detail retained.",
    ],
  });
  await createInstrumentalFixture(client, context, {
    fixture: "INST-REPEAT",
    principal: primary,
    observedAt: "2025-09-15",
    processingStatus: "ready",
    sourceText: "E2E-INST-REPEAT-SOURCE — two similar source occurrences on page 1.",
    findings: [
      "E2E repeated finding A: 8 mm synthetic focus, source occurrence 1.",
      "E2E repeated finding B: 8 mm synthetic focus, source occurrence 2.",
    ],
  });
  await createInstrumentalFixture(client, context, {
    fixture: "INST-FAILURE",
    principal: primary,
    observedAt: "2025-10-15",
    processingStatus: "failed",
    sourceText: "E2E-INST-FAILURE-SOURCE — deterministic recoverable processing fault.",
    findings: [],
  });

  // This separate account intentionally contains incomplete evidence only. It
  // keeps the empty-trend assertion independent of the primary account's
  // recognized baseline and does not require a second database.
  await createLabFixture(client, context, {
    fixture: "SAFETY-LAB-PARTIAL",
    principal: safety,
    observedAt: "2025-03-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 7.1,
    rawName: "E2E safety partial source",
    sourceText: "E2E SYNTHETIC ONLY — LAB-PARTIAL safety account — incomplete source context.",
  });
  await createLabFixture(client, context, {
    fixture: "SAFETY-LAB-AMBIGUOUS",
    principal: safety,
    observedAt: "2025-04-15",
    processingStatus: "needs_review",
    extractedStatus: "needs_review",
    value: 7.3,
    rawName: "E2E safety ambiguous source",
    sourceText: "E2E SYNTHETIC ONLY — LAB-AMBIGUOUS safety account — ambiguous source context.",
  });
}

export async function setFixtureDocumentState(
  client: SupabaseClient,
  context: E2ERunContext,
  fixture: FixtureName,
  state: { processing_status: "ready" | "needs_review" | "failed"; status: "completed" | "failed"; processing_error?: string | null },
): Promise<void> {
  const document = getFixtureDocument(context, fixture);
  assertSupabaseOk(
    await client
      .from("documents")
      .update(state)
      .eq("id", document.id)
      .eq("profile_id", document.profileId),
    `set deterministic ${fixture} document state`,
  );
}

export function getFixtureDocument(context: E2ERunContext, fixture: FixtureName): FixtureDocument {
  const document = context.documents[fixture] as FixtureDocument | undefined;
  if (!document) throw new Error(`The E2E fixture ${fixture} is absent from the ownership ledger.`);
  return document;
}

async function createLabFixture(
  client: SupabaseClient,
  context: E2ERunContext,
  options: LabFixtureOptions,
): Promise<void> {
  const document = await createDocumentFixture(client, context, {
    fixture: options.fixture,
    principal: options.principal,
    observedAt: options.observedAt,
    processingStatus: options.processingStatus ?? "needs_review",
    documentType: "lab_result",
    sourceText: options.sourceText,
  });
  const extractedId = await insertLabExtraction(client, document, options);

  if (options.includeResolvedObservation) {
    await insertResolvedLabObservation(client, document, extractedId, options);
  }
}

async function createInstrumentalFixture(
  client: SupabaseClient,
  context: E2ERunContext,
  options: InstrumentalFixtureOptions,
): Promise<void> {
  const document = await createDocumentFixture(client, context, {
    fixture: options.fixture,
    principal: options.principal,
    observedAt: options.observedAt,
    processingStatus: options.processingStatus,
    documentType: "instrumental_report",
    sourceText: options.sourceText,
  });

  for (const [index, finding] of options.findings.entries()) {
    assertSupabaseOk(
      await client.from("document_extracted_findings").insert({
        document_id: document.id,
        profile_id: document.profileId,
        modality: "E2E ultrasound",
        body_region: "E2E synthetic region",
        finding_text: finding,
        source_page: 1,
        source_text: `${options.sourceText} ${finding}`,
        confidence: 0.99,
        extraction_method: "e2e-fixture",
        processing_version: E2E_PROCESSING_VERSION,
        extraction_model: "e2e-fixture",
        status: "accepted",
      }),
      `insert ${options.fixture} finding ${index + 1}`,
    );

    const sourceId = randomUUID();
    const snapshotHash = createHash("sha256").update(`${options.fixture}:snapshot`).digest("hex");
    const sourceLocator = `e2e:${options.fixture.toLowerCase()}:page-1:occurrence-${index + 1}`;
    assertData(
      await client
        .from("document_extracted_instrumental_measures")
        .insert({
          id: sourceId,
          document_id: document.id,
          profile_id: document.profileId,
          name: `E2E instrumental measure ${index + 1}`,
          raw_name: `E2E instrumental measure ${index + 1}`,
          value: 8,
          raw_value_text: "8",
          unit: "mm",
          raw_unit: "mm",
          observed_at: options.observedAt,
          source_page: 1,
          source_text: `${options.sourceText} ${finding}`,
          source_locator: sourceLocator,
          occurrence_index: index,
          confidence: 0.99,
          modality: "E2E ultrasound",
          body_region: "E2E synthetic region",
          processing_version: E2E_PROCESSING_VERSION,
          extraction_model: "e2e-fixture",
          snapshot_hash: snapshotHash,
          is_current: true,
        })
        .select("id")
        .single(),
      `insert ${options.fixture} source occurrence ${index + 1}`,
    );

    assertSupabaseOk(
      await client.from("observations").insert({
        profile_id: document.profileId,
        document_id: document.id,
        source_instrumental_measure_id: sourceId,
        name: `E2E instrumental measure ${index + 1}`,
        value: 8,
        value_kind: "numeric",
        value_text: "8",
        unit: "mm",
        observed_at: options.observedAt,
        observation_kind: "instrumental",
        specimen: "unspecified",
        modifier: "none",
        raw_name: `E2E instrumental measure ${index + 1}`,
        raw_value_text: "8",
        raw_unit: "mm",
        source_page: 1,
        source_text: `${options.sourceText} ${finding}`,
        confidence: 0.99,
      }),
      `insert ${options.fixture} instrumental observation ${index + 1}`,
    );
  }
}

async function createDocumentFixture(
  client: SupabaseClient,
  context: E2ERunContext,
  options: {
    fixture: FixtureName;
    principal: E2EPrincipal;
    observedAt: string;
    processingStatus: "ready" | "needs_review" | "failed";
    documentType: "lab_result" | "instrumental_report";
    sourceText: string;
  },
): Promise<FixtureDocument> {
  const id = randomUUID();
  const storageRoot = `${context.storagePrefix}documents/${id}`;
  const originalStoragePath = `${storageRoot}/original.png`;
  const previewStoragePath = `${storageRoot}/page-1.png`;
  const failed = options.processingStatus === "failed";

  for (const path of [originalStoragePath, previewStoragePath]) {
    assertSupabaseOk(
      await client.storage.from(E2E_STORAGE_BUCKET).upload(path, new Blob([SOURCE_ASSET], { type: SOURCE_CONTENT_TYPE }), {
        contentType: SOURCE_CONTENT_TYPE,
        upsert: false,
      }),
      `upload ${options.fixture} synthetic source asset`,
    );
    registerStoragePath(context, path);
  }

  const created = assertData(
    await client
      .from("documents")
      .insert({
        id,
        profile_id: options.principal.profileId,
        storage_path: originalStoragePath,
        original_storage_path: originalStoragePath,
        thumbnail_storage_path: previewStoragePath,
        original_filename: `${options.fixture}.png`,
        mime_type: SOURCE_CONTENT_TYPE,
        file_size_bytes: SOURCE_ASSET.byteLength,
        document_type: options.documentType,
        file_kind: "image",
        status: failed ? "failed" : "completed",
        processing_status: options.processingStatus,
        processing_error: failed ? "E2E synthetic recoverable processing fault" : null,
        page_count: 1,
        lab_name: "E2E Synthetic Laboratory",
        observed_at: options.observedAt,
        processing_version: E2E_PROCESSING_VERSION,
        extraction_model: "e2e-fixture",
        processed_at: new Date().toISOString(),
        document_summary: `E2E SYNTHETIC ONLY — ${options.fixture}.`,
        modality: options.documentType === "instrumental_report" ? "E2E ultrasound" : null,
      })
      .select("id")
      .single(),
    `insert ${options.fixture} document`,
  ) as { id: string };

  if (created.id !== id) throw new Error(`Fixture ${options.fixture} returned an unexpected document id.`);

  const document: FixtureDocument = {
    id,
    profileId: options.principal.profileId,
    fixture: options.fixture,
    storagePaths: [originalStoragePath, previewStoragePath],
    observedAt: options.observedAt,
    sourceText: options.sourceText,
  };
  registerDocument(context, document);
  if (context.documents[options.fixture]?.id !== id) {
    throw new Error(`Fixture ${options.fixture} was not written to the E2E ownership ledger.`);
  }

  assertSupabaseOk(
    await client.from("document_pages").insert({
      document_id: id,
      profile_id: options.principal.profileId,
      page_number: 1,
      width: 900,
      height: 1200,
      preview_storage_path: previewStoragePath,
      ocr_text: options.sourceText,
    }),
    `insert ${options.fixture} page`,
  );

  return document;
}

async function insertLabExtraction(
  client: SupabaseClient,
  document: FixtureDocument,
  options: LabFixtureOptions,
): Promise<string> {
  const rawName = options.rawName ?? "Glucose";
  const extraction = assertData(
    await client
      .from("document_extracted_biomarkers")
      .insert({
        document_id: document.id,
        profile_id: document.profileId,
        biomarker_key: rawName === "Glucose" ? "glucose_serum" : null,
        biomarker_name: rawName,
        raw_name: rawName,
        value_numeric: options.value,
        value_text: String(options.value),
        value_kind: "numeric",
        unit: "mmol/L",
        raw_unit: "mmol/L",
        raw_value_text: String(options.value),
        reference_range: "3.9–5.5",
        raw_reference_range: "3.9–5.5",
        specimen: rawName === "Glucose" ? "serum" : "unspecified",
        modifier: "none",
        source_page: 1,
        source_text: document.sourceText,
        confidence: 0.99,
        extraction_method: "e2e-fixture",
        processing_version: E2E_PROCESSING_VERSION,
        extraction_model: "e2e-fixture",
        status: options.extractedStatus ?? "needs_review",
        is_current: true,
      })
      .select("id")
      .single(),
    `insert ${options.fixture} extracted laboratory evidence`,
  ) as { id: string };
  return extraction.id;
}

async function insertResolvedLabObservation(
  client: SupabaseClient,
  document: FixtureDocument,
  extractedId: string,
  options: LabFixtureOptions,
): Promise<void> {
  assertSupabaseOk(
    await client.from("observations").insert({
      profile_id: document.profileId,
      document_id: document.id,
      source_extracted_biomarker_id: extractedId,
      observation_kind: "lab",
      name: "Glucose",
      value: options.value,
      value_kind: "numeric",
      value_text: String(options.value),
      unit: "mmol/L",
      ref_low: 3.9,
      ref_high: 5.5,
      observed_at: options.observedAt,
      specimen: "serum",
      modifier: "none",
      raw_name: "Glucose",
      raw_value_text: String(options.value),
      raw_reference_text: "3.9–5.5",
      raw_unit: "mmol/L",
      source_page: 1,
      source_text: document.sourceText,
      confidence: 0.99,
      extraction_version: E2E_PROCESSING_VERSION,
      provenance_schema_version: "e2e-fixture-v1",
      catalog_manifest_version: "e2e-fixture-v1",
      catalog_manifest_digest: createHash("sha256").update("e2e-fixture-v1").digest("hex"),
      resolver_version: "e2e-fixture-v1",
      normalization_version: "e2e-fixture-v1",
      analyte_key: "glucose",
      measurement_definition_key: "glucose_serum",
      resolution_status: "resolved",
    }),
    `insert ${options.fixture} resolved laboratory observation`,
  );
}

function requirePrincipal(context: E2ERunContext, key: "primary" | "safety"): E2EPrincipal {
  const principal = context.principals[key];
  if (!principal) throw new Error(`The ${key} E2E principal is missing before fixture setup.`);
  return principal;
}
