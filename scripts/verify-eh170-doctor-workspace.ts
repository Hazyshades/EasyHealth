import assert from "node:assert/strict";
import {
  canTransitionRecording,
  resolveDoctorConsultationSelection,
  sanitizeDoctorNoteCandidate,
} from "../src/lib/doctor-workspace/lifecycle";

const sanitized = sanitizeDoctorNoteCandidate({
  summary: "Source-grounded summary",
  diagnosis: "Unsupported directive",
  treatment: "Unsupported directive",
  metadata: { diagnosis: "Nested unsupported directive" },
  limitations: ["Existing limitation"],
});
assert.equal("diagnosis" in sanitized, false);
assert.equal("treatment" in sanitized, false);
assert.equal(
  "diagnosis" in (sanitized.metadata as Record<string, unknown>),
  false,
);
assert.deepEqual(sanitized.limitations, [
  "Existing limitation",
  "Unsupported clinical directives were omitted",
]);

assert.equal(canTransitionRecording("recording", "uploading"), true);
assert.equal(canTransitionRecording("transcribing", "transcript_ready"), true);
assert.equal(canTransitionRecording("transcript_ready", "recording"), false);
assert.equal(canTransitionRecording("deleted", "uploaded"), false);

assert.equal(
  resolveDoctorConsultationSelection(
    [{ consultation_id: "consultation-a" }, { consultation_id: "consultation-b" }],
    "consultation-b",
  ),
  "consultation-b",
);
assert.equal(
  resolveDoctorConsultationSelection(
    [{ consultation_id: "consultation-a" }, { consultation_id: "consultation-b" }],
    "consultation-missing",
  ),
  "consultation-a",
);

console.log("EH-170 lifecycle verification passed");
