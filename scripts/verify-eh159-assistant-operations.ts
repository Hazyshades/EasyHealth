import assert from "node:assert/strict";
import { assistantFeedbackRequestSchema } from "../src/lib/assistant/contract";

const valid = assistantFeedbackRequestSchema.safeParse({
  request_id: "00000000-0000-4000-8000-000000159101",
  rating: "negative",
  category: "missing_evidence",
  comment: "The source was not clear.",
});
assert.equal(valid.success, true);

assert.equal(
  assistantFeedbackRequestSchema.safeParse({
    request_id: "00000000-0000-4000-8000-000000159101",
    rating: "negative",
    category: "free_form_category",
  }).success,
  false,
);
assert.equal(
  assistantFeedbackRequestSchema.safeParse({
    request_id: "00000000-0000-4000-8000-000000159101",
    rating: "positive",
    profile_id: "00000000-0000-4000-8000-000000159001",
  }).success,
  false,
);
assert.equal(
  assistantFeedbackRequestSchema.safeParse({
    request_id: "00000000-0000-4000-8000-000000159101",
    rating: "positive",
    comment: "x".repeat(2_001),
  }).success,
  false,
);

console.log("EH-159 assistant operations verification passed");
