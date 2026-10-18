import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertReviewModeActionAllowed,
  assertReviewModeEscalationAllowed,
  assertReviewModeSelectionAllowed,
  effectiveReviewMode,
  reviewModeActionAvailability,
  ReviewModePolicyError,
  type ReviewModeDocument,
} from "../src/lib/documents/review-mode-policy";

const unlockedEasy: ReviewModeDocument = {
  id: "document-easy",
  profile_id: "owner",
  document_type: "lab_result",
  review_mode: "easy",
  review_mode_locked_at: null,
};
const unlockedPro: ReviewModeDocument = {
  ...unlockedEasy,
  id: "document-pro",
  review_mode: "pro",
};
const lockedEasy: ReviewModeDocument = {
  ...unlockedEasy,
  review_mode_locked_at: "2026-08-14T10:00:00.000Z",
};
const lockedPro: ReviewModeDocument = {
  ...unlockedPro,
  review_mode_locked_at: "2026-08-14T10:00:00.000Z",
};
const nonLaboratory: ReviewModeDocument = {
  ...unlockedPro,
  id: "document-instrumental",
  document_type: "instrumental_report",
  review_mode: null,
};

assert.equal(effectiveReviewMode(unlockedEasy), "easy");
assert.equal(effectiveReviewMode(unlockedPro), "pro");
assert.equal(effectiveReviewMode(nonLaboratory), null);
assert.doesNotThrow(() => assertReviewModeSelectionAllowed(unlockedEasy));
assert.throws(
  () => assertReviewModeSelectionAllowed(lockedEasy),
  (error: unknown) =>
    error instanceof ReviewModePolicyError &&
    error.code === "review_mode_locked" &&
    error.status === 409,
);
assert.doesNotThrow(() => assertReviewModeEscalationAllowed(lockedEasy));
assert.throws(
  () => assertReviewModeEscalationAllowed(lockedPro),
  (error: unknown) =>
    error instanceof ReviewModePolicyError &&
    error.code === "review_mode_escalation_unavailable",
);

for (const action of ["accept", "reject", "reprocess"] as const) {
  assert.equal(
    reviewModeActionAvailability(unlockedEasy, action).available,
    true,
  );
  assert.doesNotThrow(() =>
    assertReviewModeActionAllowed(unlockedEasy, action),
  );
}
for (const action of [
  "correct",
  "edit_value",
  "undo",
  "manual_mapping",
  "batch_verify",
  "batch_reverse",
  "confirm_observations",
] as const) {
  const availability = reviewModeActionAvailability(unlockedEasy, action);
  assert.equal(availability.available, false);
  assert.equal(availability.code, "easy_mode_restriction");
  assert.throws(
    () => assertReviewModeActionAllowed(unlockedEasy, action),
    (error: unknown) =>
      error instanceof ReviewModePolicyError &&
      error.code === "easy_mode_restriction" &&
      error.status === 403,
  );
  assert.doesNotThrow(() => assertReviewModeActionAllowed(unlockedPro, action));
}
assert.equal(
  reviewModeActionAvailability(nonLaboratory, "accept").code,
  "review_mode_not_applicable",
);

const route = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");
const settings = route("src/app/app/settings/page.tsx");
const viewer = route("src/components/documents/document-viewer.tsx");
assert.match(settings, /review_mode_default/);
assert.match(settings, /saveReviewModeDefault/);
assert.match(settings, /Read extracted evidence, then accept or reject/);
assert.match(settings, /Review mappings, correct values, and verify in detail/);
const patchRoute = route("src/app/api/documents/[id]/biomarkers/route.ts");
assert.match(patchRoute, /assertReviewModeActionAllowed\(doc!, reviewAction\)/);
assert.match(patchRoute, /reviewMode,/);
assert.match(
  route("src/app/api/documents/[id]/biomarkers/accept/route.ts"),
  /assertReviewModeActionAllowed\(doc!, "accept"\)/,
);
assert.match(
  route("src/app/api/documents/[id]/biomarkers/reject/route.ts"),
  /assertReviewModeActionAllowed\(doc!, "reject"\)/,
);
assert.match(
  route("src/app/api/documents/[id]/biomarkers/batch-verification/route.ts"),
  /assertReviewModeActionAllowed\(doc!, "batch_verify"\)/,
);
assert.match(
  route(
    "src/app/api/documents/[id]/biomarkers/batch-verification/reverse/route.ts",
  ),
  /assertReviewModeActionAllowed\(doc!, "batch_reverse"\)/,
);
assert.match(
  route("src/app/api/documents/[id]/biomarkers/confirm-observations/route.ts"),
  /assertReviewModeActionAllowed\(doc!, "confirm_observations"\)/,
);
assert.match(
  route("src/app/api/documents/[id]/reprocess/route.ts"),
  /assertReviewModeActionAllowed\(doc!, "reprocess"\)/,
);
const modeRoute = route("src/app/api/documents/[id]/review-mode/route.ts");
assert.match(modeRoute, /\.is\("review_mode_locked_at", null\)/);
assert.match(modeRoute, /\.not\("review_mode_locked_at", "is", null\)/);
assert.match(modeRoute, /review_mode_confirmation_required/);
assert.match(modeRoute, /review_mode_conflict/);
assert.match(patchRoute, /stale_revision_conflict/);
assert.match(patchRoute, /assertDocumentOwner\(profileId, id\)/);
assert.match(viewer, /Enter Pro mode/);
assert.match(
  viewer,
  /Accepting keeps every selected result exactly as reported/,
);
assert.match(viewer, /Reject source/);
assert.match(viewer, /Reprocess document/);
assert.match(viewer, /!isEasyReview &&/);
const migration = route("supabase/migrations/088_document_review_modes.sql");
assert.match(migration, /review_mode_locked_at/);
assert.match(migration, /review_mode_at_write/);
assert.match(
  migration,
  /write_observation_normalization_revision_with_review_mode/,
);
assert.match(
  migration,
  /restore_observation_normalization_revision_with_review_mode/,
);

console.log("review mode policy and route checks passed");
