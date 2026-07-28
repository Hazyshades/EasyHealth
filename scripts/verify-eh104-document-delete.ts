import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/api/documents/[id]/route.ts", "utf8");
const helper = readFileSync(
  "src/lib/documents/laboratory-lineage-purge.ts",
  "utf8"
);

assert.match(
  route,
  /export async function DELETE/,
  "document route must expose DELETE"
);
assert.match(
  route,
  /getSessionProfileId/,
  "document DELETE must resolve the session profile"
);
assert.match(
  route,
  /assertDocumentOwner/,
  "document DELETE must verify document ownership before purge"
);
assert.match(
  route,
  /purgeDocumentDerivedLaboratoryLineage\(id\)/,
  "document DELETE must purge laboratory lineage for the document id"
);

const purgeIndex = route.indexOf("purgeDocumentDerivedLaboratoryLineage(id)");
const deleteIndex = route.indexOf('.from("documents").delete()');
assert.ok(purgeIndex >= 0 && deleteIndex >= 0, "purge and delete calls must exist");
assert.ok(
  purgeIndex < deleteIndex,
  "laboratory lineage purge must run before documents.delete"
);

assert.match(
  helper,
  /createAdminClient/,
  "purge helper must use the service/admin client"
);
assert.match(
  helper,
  /purge_document_derived_laboratory_lineage/,
  "purge helper must call the Phase B RPC"
);

console.log("verify-eh104-document-delete: passed");
