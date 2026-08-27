/**
 * Seed synthetic EH-147 Health Profile cases into local Docker Supabase.
 * Idempotent on dedicated profile ids. Does not touch the EH-146 fixture profile.
 *
 * Run: corepack pnpm exec tsx scripts/eh147-seed-local-supabase.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listGoldenCases, type GoldenCase } from "./eh147-golden-pack";

const envCandidates = [
  resolve(import.meta.dirname, "../.env.local"),
  resolve(import.meta.dirname, "../.env"),
  "C:/github/1. ARC/EasyHealth/.env.local",
  "C:/github/1. ARC/EasyHealth/.env",
];
for (const envPath of envCandidates) {
  if (!existsSync(envPath)) continue;
  const envText = readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim().replace(/^"|"$/g, "");
    }
  }
}
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54321";
process.env.URL ||= "http://localhost:3001";
process.env.OPENAI_API_KEY ||= "sk-local-eh147-unused";

const CASES = {
  complete: {
    id: "a1470001-fbd4-4000-8000-000000000147",
    email: "eh147-complete@easyhealth.local",
    firstName: "EH147",
    lastName: "Complete",
    goldenId: "complete-in-range-eight-systems",
    filename: "EH147-UI-COMPLETE.pdf",
  },
  missing: {
    id: "a1470002-fbd4-4000-8000-000000000147",
    email: "eh147-missing@easyhealth.local",
    firstName: "EH147",
    lastName: "Missing",
    goldenId: "missing-group-thyroid",
    filename: "EH147-UI-MISSING.pdf",
  },
  correct: {
    id: "a1470003-fbd4-4000-8000-000000000147",
    email: "eh147-correct@easyhealth.local",
    firstName: "EH147",
    lastName: "Correct",
    goldenId: "complete-in-range-eight-systems",
    filename: "EH147-UI-CORRECT.pdf",
    pendingKey: "fasting_glucose",
  },
} as const;

function uuidFrom(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type AdminClient = ReturnType<(typeof import("../src/lib/supabase/admin"))["createAdminClient"]>;

async function ensureUser(
  admin: AdminClient,
  id: string,
  email: string,
  firstName: string,
  lastName: string,
) {
  const { data: existing } = await admin.auth.admin.getUserById(id);
  if (!existing.user) {
    const created = await admin.auth.admin.createUser({
      id,
      email,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (created.error) throw new Error(`createUser ${email}: ${created.error.message}`);
  }
  const now = new Date().toISOString();
  const { error } = await admin.from("profiles").upsert({
    id,
    email,
    first_name: firstName,
    last_name: lastName,
    display_name: `${firstName} ${lastName}`,
    terms_accepted_at: now,
    terms_version: "eh147-test",
    health_data_consent_at: now,
    ai_consent_at: now,
    onboarding_completed_at: now,
    lab_unit_system: "si",
  });
  if (error) throw new Error(`profile upsert ${email}: ${error.message}`);
}

async function seedCase(
  admin: AdminClient,
  spec: (typeof CASES)[keyof typeof CASES],
  golden: GoldenCase,
) {
  const observations = golden.observations ?? [];
  const documentId = uuidFrom(`${spec.id}:document`);
  const { data: existingDoc } = await admin.from("documents").select("id").eq("id", documentId).maybeSingle();
  if (existingDoc) {
    console.log(spec.email, "already seeded; completing assessment if needed");
    const { data: job } = await admin.from("assessment_recalculation_jobs").select("id, status").eq("profile_id", spec.id).maybeSingle();
    if (job && job.status !== "succeeded") {
      if (job.status !== "processing") {
        await admin.from("assessment_recalculation_jobs").update({
          status: "processing",
          started_at: new Date().toISOString(),
          lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        }).eq("id", job.id);
      }
      const { buildHealthProfileSnapshot } = await import("../src/lib/health-profile-snapshot");
      const snapshot = await buildHealthProfileSnapshot({ profileId: spec.id, labUnitSystem: "si" });
      const { error: completeError } = await admin.rpc("complete_assessment_recalculation_job", {
        p_job_id: job.id,
        p_input_hash: snapshot.inputHash,
        p_payload: snapshot.profile,
        p_source_document_ids: snapshot.sourceDocumentIds,
      });
      if (completeError) throw new Error(`complete ${spec.email}: ${completeError.message}`);
      console.log(spec.email, "assessment completed");
    }
    return;
  }

  const { error: documentError } = await admin.from("documents").insert({
    id: documentId,
    profile_id: spec.id,
    storage_path: `eh147/${spec.filename}`,
    original_filename: spec.filename,
    status: "completed",
    lab_name: "Synthetic laboratory",
    observed_at: "2026-08-01",
    document_type: "lab_result",
    file_kind: "pdf",
    processing_status: "ready",
    ocr_status: "pending",
    extraction_status: "pending",
  });
  if (documentError) throw new Error(`document ${spec.filename}: ${documentError.message}`);

  for (const [index, observation] of observations.entries()) {
    const extractedId = uuidFrom(`${spec.id}:extracted:${observation.biomarker_key}:${index}`);
    const revisionId = uuidFrom(`${spec.id}:revision:${observation.biomarker_key}:${index}`);
    const observationId = observation.observation_id?.startsWith("obs-")
      ? uuidFrom(`${spec.id}:obs:${observation.biomarker_key}:${index}`)
      : (observation.observation_id ?? randomUUID());
    const pending =
      "pendingKey" in spec && spec.pendingKey === observation.biomarker_key;
    const definitionKey = observation.measurement_definition_key!;
    const verificationStatus = pending ? "pending" : "user_verified";

    const { error: extractedError } = await admin.from("document_extracted_biomarkers").insert({
      id: extractedId,
      document_id: documentId,
      profile_id: spec.id,
      biomarker_name: observation.name,
      raw_name: observation.name,
      biomarker_key: observation.biomarker_key,
      value_numeric: observation.value,
      value_text: String(observation.value),
      value_kind: "numeric",
      unit: observation.unit,
      raw_unit: observation.unit,
      specimen: observation.specimen ?? "unspecified",
      modifier: observation.modifier ?? "none",
      measurement_definition_key: definitionKey,
      source_text: `${observation.name} ${observation.value} ${observation.unit}`,
      status: "accepted",
      record_status: "active",
      is_current: true,
      is_published: true,
      source_page: 1,
    });
    if (extractedError) throw new Error(`extracted ${observation.name}: ${extractedError.message}`);

    const revision = {
      id: revisionId,
      extracted_biomarker_id: extractedId,
      input_evidence_hash: `eh147-${observation.biomarker_key}-${index}`,
      measurement_definition_key: definitionKey,
      resolver_result: "resolved",
      mapping_confidence: 0.95,
      catalog_manifest_version: "eh147-test",
      resolver_version: "eh147-resolver",
      normalization_version: "eh147-norm",
      verification_status: verificationStatus,
      is_active: true,
      mapping_confidence_band: "high",
      resolver_evidence: {
        version: 2,
        outcome: "resolved",
        candidateKeys: [definitionKey],
        selectedCandidateKey: definitionKey,
        conflictCodes: [],
        admissibilityRejections: [],
      },
      catalog_manifest_digest: "eh147-digest",
      analyte_key: observation.biomarker_key,
      verification_decided_at: pending ? null : new Date().toISOString(),
      verification_actor_type: pending ? null : "user",
      verification_actor_id: pending ? null : spec.id,
    };
    const { error: revisionError } = await admin.from("observation_normalization_revisions").insert(revision);
    if (revisionError) throw new Error(`revision ${observation.name}: ${revisionError.message}`);

    const rawReference =
      observation.ref_low != null && observation.ref_high != null
        ? `${observation.ref_low}-${observation.ref_high}`
        : "";
    const { error: observationError } = await admin.from("observations").insert({
      id: observationId,
      profile_id: spec.id,
      document_id: documentId,
      name: observation.name,
      value: observation.value,
      unit: observation.unit,
      ref_low: observation.ref_low,
      ref_high: observation.ref_high,
      observed_at: observation.observed_at,
      source_extracted_biomarker_id: extractedId,
      observation_kind: "lab",
      value_kind: "numeric",
      value_text: String(observation.value),
      specimen: observation.specimen ?? "unspecified",
      modifier: observation.modifier ?? "none",
      source_page: 1,
      measurement_definition_key: definitionKey,
      normalization_revision_id: revisionId,
      resolution_status: "resolved",
      raw_reference_text: rawReference,
      provenance_schema_version: "1",
    });
    if (observationError) throw new Error(`observation ${observation.name}: ${observationError.message}`);
  }

  const { data: job, error: jobError } = await admin
    .from("assessment_recalculation_jobs")
    .select("id, status")
    .eq("profile_id", spec.id)
    .maybeSingle();
  if (jobError) throw new Error(`job lookup ${spec.email}: ${jobError.message}`);
  if (job) {
    if (job.status !== "processing") {
      const { error: processError } = await admin
        .from("assessment_recalculation_jobs")
        .update({
          status: "processing",
          started_at: new Date().toISOString(),
          lease_expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
        })
        .eq("id", job.id);
      if (processError) throw new Error(`job process ${spec.email}: ${processError.message}`);
    }
    const { buildHealthProfileSnapshot } = await import("../src/lib/health-profile-snapshot");
    const snapshot = await buildHealthProfileSnapshot({ profileId: spec.id, labUnitSystem: "si" });
    const { error: completeError } = await admin.rpc("complete_assessment_recalculation_job", {
      p_job_id: job.id,
      p_input_hash: snapshot.inputHash,
      p_payload: snapshot.profile,
      p_source_document_ids: snapshot.sourceDocumentIds,
    });
    if (completeError) throw new Error(`complete ${spec.email}: ${completeError.message}`);
    const scores = snapshot.profile.systems
      .filter((system) =>
        ["cardiovascular", "metabolic", "thyroid", "liver", "kidney", "blood", "nutrients", "inflammation"].includes(
          system.id,
        ),
      )
      .map((system) => `${system.id}:${system.scoreability}:${system.state_score}`);
    console.log(spec.email, "seeded", observations.length, "rows", scores.join(", "));
  } else {
    console.log(spec.email, "seeded", observations.length, "rows; no assessment job queued");
  }
}

async function main() {
  const { createAdminClient } = await import("../src/lib/supabase/admin");
  const admin = createAdminClient();
  const cases = listGoldenCases();
  for (const spec of Object.values(CASES)) {
    const golden = cases.find((item) => item.id === spec.goldenId);
    if (!golden) throw new Error(`missing golden case ${spec.goldenId}`);
    await ensureUser(admin, spec.id, spec.email, spec.firstName, spec.lastName);
    await seedCase(admin, spec, golden);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
