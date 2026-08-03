/**
 * Disposable-only PR2 instrumental publication reset.
 *
 * Requires both:
 *   EH105_PR2_DISPOSABLE=1
 *   EH105_PR2_ALLOW_RESET=1
 *
 * Migration `037` must already exist: this script calls
 * `pr2_reset_instrumental_publication_state`, which is created by that
 * migration. For a fresh disposable bootstrap, prefer `supabase db reset`.
 *
 * Does not invent semantic repairs. After success, reprocess instrumental
 * documents and continue only when publication preflight/backfill would be
 * clean on a retained environment.
 */
import { createAdminClient } from "../src/lib/supabase/admin";

async function main() {
  const disposable = process.env.EH105_PR2_DISPOSABLE;
  const allowReset = process.env.EH105_PR2_ALLOW_RESET;
  if (disposable !== "1" && disposable !== "true" && disposable !== "on") {
    throw new Error(
      "EH105_PR2_DISPOSABLE must be set to 1 (or true/on) for disposable PR2 reset"
    );
  }
  if (allowReset !== "1" && allowReset !== "true" && allowReset !== "on") {
    throw new Error(
      "EH105_PR2_ALLOW_RESET must be set to 1 (or true/on) for disposable PR2 reset"
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc(
    "pr2_reset_instrumental_publication_state",
    { p_confirm_disposable_reset: true }
  );
  if (error) throw error;

  console.log(
    JSON.stringify(
      {
        status: "reset_complete",
        result: data,
        next: "reprocess instrumental documents; do not use this on retained data",
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
