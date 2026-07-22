/**
 * Disposable-only EH-104 Phase B document-derived laboratory lineage reset.
 *
 * Requires both:
 *   EH104_PHASE_B_DISPOSABLE=1
 *   EH104_PHASE_B_ALLOW_RESET=1
 *
 * Does not invent semantic repairs. After success, run:
 *   pnpm preflight:eh104
 * and apply the Phase B enforcement migration only when preflight is clean.
 */
import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const disposable = process.env.EH104_PHASE_B_DISPOSABLE;
  const allowReset = process.env.EH104_PHASE_B_ALLOW_RESET;
  if (disposable !== "1" && disposable !== "true" && disposable !== "on") {
    throw new Error(
      "EH104_PHASE_B_DISPOSABLE must be set to 1 (or true/on) for disposable Phase B reset"
    );
  }
  if (allowReset !== "1" && allowReset !== "true" && allowReset !== "on") {
    throw new Error(
      "EH104_PHASE_B_ALLOW_RESET must be set to 1 (or true/on) for disposable Phase B reset"
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "eh104_phase_b_reset_document_derived_laboratory_lineage",
    { p_confirm_disposable_reset: true }
  );
  if (error) throw error;

  console.log(
    JSON.stringify(
      {
        status: "reset_complete",
        result: data,
        next: "pnpm preflight:eh104",
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
