import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/103_eh170_doctor_workspace_runtime.sql",
  "utf8",
);
const projection = readFileSync(
  "src/lib/doctor-workspace/projection.ts",
  "utf8",
);
const detailRoute = readFileSync(
  "src/app/api/doctor-workspace/recordings/[recordingId]/route.ts",
  "utf8",
);
const uploadRoute = readFileSync(
  "src/app/api/doctor-workspace/recordings/upload/route.ts",
  "utf8",
);
const recordingsRoute = readFileSync(
  "src/app/api/doctor-workspace/recordings/route.ts",
  "utf8",
);
const worker = readFileSync("worker/src/doctor-transcription.ts", "utf8");
const workerEnv = readFileSync("worker/src/env.ts", "utf8");

assert.match(migration, /eh170_authorize_patient_access/);
assert.match(migration, /eh170_write_access_event/);
assert.match(migration, /eh170_recording_consent_required/);
assert.match(projection, /resolveDoctorWorkspaceAccess/);
assert.match(projection, /createSignedStorageUrl/);
assert.match(detailRoute, /storage_path: _storagePath/);
assert.match(migration, /source_audio_deleted_at is null/);
assert.match(uploadRoute, /cancelDoctorRecording/);
assert.match(uploadRoute, /return NextResponse\.json\(\{ data: completed \}/);
assert.match(recordingsRoute, /deleteDoctorRecordingObject/);
assert.match(recordingsRoute, /markDoctorRecordingAudioDeleted/);
assert.doesNotMatch(
  worker,
  /console\.(log|error)\([^\n]*(transcript|result\.text|audio)/i,
);
assert.match(worker, /provider_unavailable/);
assert.match(worker, /provider_timeout/);
assert.match(worker, /provider_rejected/);
assert.match(worker, /audio_unavailable/);
assert.match(workerEnv, /isUuid\(eh170RetentionDeleteActor\)/);

console.log("EH-170 security boundary verification passed");
