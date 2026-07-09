/**
 * Idempotent backfill: map known alias biomarker_key values → canonical keys.
 *
 * Usage (from repo root, with env for service role):
 *   node --env-file=.env.local scripts/backfill-biomarker-aliases.mjs
 *   node --env-file=.env.local scripts/backfill-biomarker-aliases.mjs --dry-run
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");

/** Subset of high-value aliases; extend as needed. Canonical wins. */
const ALIAS_TO_CANONICAL = {
  na: "sodium",
  k: "potassium",
  cl: "chloride",
  co2: "bicarbonate",
  hco3: "bicarbonate",
  carbon_dioxide: "bicarbonate",
  total_co2: "bicarbonate",
  lp_a: "lpa",
  lipoprotein_a: "lpa",
  tsat: "transferrin_saturation",
  t_sat: "transferrin_saturation",
  "25_oh_vitamin_d": "vitamin_d",
  "25_ohd": "vitamin_d",
  hb: "hemoglobin",
  hgb: "hemoglobin",
  hct: "hematocrit",
  a1c: "hba1c",
  hb_a1c: "hba1c",
  fpg: "fasting_glucose",
  ldl_c: "ldl",
  hdl_c: "hdl",
  non_hdl: "non_hdl_cholesterol",
  non_hdl_c: "non_hdl_cholesterol",
  apo_b: "apob",
  free_thyroxine: "free_t4",
  ft4: "free_t4",
  ft3: "free_t3",
  sgpt: "alt",
  sgot: "ast",
  creat: "creatinine",
  blood_urea_nitrogen: "bun",
  phosphorus: "phosphate",
  po4: "phosphate",
  serum_iron: "iron",
  fe: "iron",
  hs_crp: "hs_crp",
  high_sensitivity_crp: "hs_crp",
  c_reactive_protein: "crp",
  acr: "uacr",
  albumin_creatinine_ratio: "uacr",
};

function rowCompleteness(row) {
  let score = 0;
  if (row.unit && String(row.unit).trim()) score += 2;
  if (row.ref_low != null) score += 1;
  if (row.ref_high != null) score += 1;
  if (row.name && String(row.name).trim()) score += 1;
  return score;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const aliases = Object.keys(ALIAS_TO_CANONICAL);

  const { data: rows, error } = await supabase
    .from("observations")
    .select("id, profile_id, biomarker_key, name, value, unit, ref_low, ref_high, observed_at")
    .in("biomarker_key", aliases);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const list = rows ?? [];
  console.log(`Found ${list.length} observations with alias keys`);

  let updated = 0;
  let deleted = 0;
  let skipped = 0;

  for (const row of list) {
    const canonical = ALIAS_TO_CANONICAL[row.biomarker_key];
    if (!canonical || canonical === row.biomarker_key) {
      skipped++;
      continue;
    }

    const { data: existing } = await supabase
      .from("observations")
      .select("id, unit, ref_low, ref_high, name")
      .eq("profile_id", row.profile_id)
      .eq("biomarker_key", canonical)
      .eq("observed_at", row.observed_at)
      .maybeSingle();

    if (existing) {
      const keepAlias = rowCompleteness(row) > rowCompleteness(existing);
      if (keepAlias) {
        if (!DRY_RUN) {
          await supabase.from("observations").delete().eq("id", existing.id);
          await supabase
            .from("observations")
            .update({ biomarker_key: canonical })
            .eq("id", row.id);
        }
        deleted++;
        updated++;
        console.log(
          `merge: keep alias→${canonical} profile=${row.profile_id} date=${row.observed_at}`
        );
      } else {
        if (!DRY_RUN) {
          await supabase.from("observations").delete().eq("id", row.id);
        }
        deleted++;
        console.log(
          `merge: drop alias ${row.biomarker_key} keep ${canonical} profile=${row.profile_id}`
        );
      }
      continue;
    }

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from("observations")
        .update({ biomarker_key: canonical })
        .eq("id", row.id);
      if (upErr) {
        console.error(`update failed ${row.id}: ${upErr.message}`);
        continue;
      }
    }
    updated++;
    console.log(`${row.biomarker_key} → ${canonical} id=${row.id}`);
  }

  console.log(
    `${DRY_RUN ? "[dry-run] " : ""}done: updated=${updated} deleted=${deleted} skipped=${skipped}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
