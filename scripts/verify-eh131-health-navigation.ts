import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildHealthNavigationPath,
  healthRouteLabel,
  readHealthNavigationContext,
  resolveHealthReturnPath,
} from "../src/lib/health-navigation";

const origin = "https://easyhealth.internal";
const profileReturnPath = "/app/profile?system=metabolic";
const biomarkerPath = buildHealthNavigationPath("/app/biomarkers", {
  system: "metabolic",
  measurement: "glucose",
  observation: "obs-1",
  returnTo: profileReturnPath,
});
const biomarkerUrl = new URL(biomarkerPath, origin);
const biomarkerContext = readHealthNavigationContext(biomarkerUrl.searchParams);

assert.equal(biomarkerUrl.pathname, "/app/biomarkers");
assert.equal(biomarkerContext.system, "metabolic");
assert.equal(biomarkerContext.measurement, "glucose");
assert.equal(biomarkerContext.observation, "obs-1");
assert.equal(biomarkerContext.returnTo, profileReturnPath);
assert.equal(
  resolveHealthReturnPath("https://example.invalid/account", "/app"),
  "/app",
  "external return targets fall back locally",
);
assert.equal(resolveHealthReturnPath("//example.invalid/account", "/app"), "/app");
assert.equal(resolveHealthReturnPath("/\\example.invalid/account", "/app"), "/app");
assert.equal(resolveHealthReturnPath("/app/profile\nmalicious", "/app"), "/app");
assert.equal(healthRouteLabel(profileReturnPath), "Health Profile");
assert.equal(healthRouteLabel("/app/timeline?type=referral&page=2"), "Health Timeline");
assert.equal(healthRouteLabel("/app/documents/document-1"), "Documents");

const documentPath = buildHealthNavigationPath("/app/documents/doc-1", {
  system: biomarkerContext.system,
  measurement: biomarkerContext.measurement,
  observation: biomarkerContext.observation,
  returnTo: biomarkerPath,
});
const documentContext = readHealthNavigationContext(
  new URL(documentPath, origin).searchParams,
);
assert.equal(documentContext.returnTo, biomarkerPath);
assert.equal(documentContext.measurement, "glucose");
assert.equal(documentContext.observation, "obs-1");

const drawer = readFileSync("src/components/health-profile-drawer.tsx", "utf8");
assert.match(drawer, /buildHealthNavigationPath\("\/app\/biomarkers"/);
assert.match(drawer, /buildHealthNavigationPath\(`\/app\/documents\/\$\{marker\.source\.id\}`/);
assert.match(drawer, /measurement_definition_key/);
assert.match(drawer, /returnTo: profilePath/);

const profilePage = readFileSync("src/app/app/profile/page.tsx", "utf8");
assert.match(profilePage, /readHealthNavigationContext/);
assert.match(profilePage, /buildHealthNavigationPath\("\/app\/profile"/);
assert.match(profilePage, /onExternalSelect=\{handleSystemSelection\}/);

const biomarkersPage = readFileSync("src/app/app/biomarkers/biomarkers-page-client.tsx", "utf8");
assert.match(biomarkersPage, /navigationContext\.measurement/);
assert.match(biomarkersPage, /selectedObservationId/);
assert.match(biomarkersPage, /window\.history\.replaceState/);
assert.match(biomarkersPage, /<ContextBreadcrumbs/);
assert.match(biomarkersPage, /sourceReturnTo=\{biomarkerContextPath\}/);

const table = readFileSync("src/components/biomarker-table.tsx", "utf8");
assert.match(table, /observationSourceHref/);
assert.match(table, /selectedObservationId/);
assert.match(table, /measurement: observation\.measurement_definition_key/);
assert.match(table, /if \(!observation\.documents\?\.id\) return null/);

const chart = readFileSync("src/components/biomarker-chart.tsx", "utf8");
assert.match(chart, /Source records/);
assert.match(chart, /sourceHref/);
assert.match(chart, /aria-current/);

const timeline = readFileSync("src/app/app/timeline/page.tsx", "utf8");
assert.match(timeline, /timelineReturnPath/);
assert.match(timeline, /returnTo: timelineReturnPath/);
assert.match(timeline, /observation: measurement\.id/);
assert.match(timeline, /<ContextBreadcrumbs/);

const viewer = readFileSync("src/components/documents/document-viewer.tsx", "utf8");
assert.match(timeline, /parseTimelineQuery/);
assert.match(timeline, /setPage\(parsedQuery\.value\.page\)/);
assert.match(viewer, /readHealthNavigationContext\(searchParams\)/);
assert.match(viewer, /const backHref = navigationContext\.returnTo \?\? "\/app\/documents"/);
assert.match(viewer, /navigationContext\.observation/);
assert.match(viewer, /source_extracted_biomarker_id/);
assert.match(viewer, /setSelectedRowId\(deepLinkedRow\.id\)/);
assert.match(viewer, /<ContextBreadcrumbs/);
assert.match(viewer, /<Link href=\{backHref\}/);

const biomarkerRoute = readFileSync("src/app/api/biomarkers/route.ts", "utf8");
assert.match(biomarkerRoute, /\.eq\("profile_id", profileId\)/);
const profileSnapshot = readFileSync("src/lib/health-profile-snapshot.ts", "utf8");
assert.match(profileSnapshot, /\.eq\("profile_id", options\.profileId\)/);
const documentRoute = readFileSync("src/app/api/documents/[id]/route.ts", "utf8");
assert.match(documentRoute, /assertDocumentOwner\(profileId, id\)/);

const navigation = readFileSync("src/lib/navigation.ts", "utf8");
assert.match(navigation, /"\/app\/biomarkers"/);
assert.match(navigation, /pathname\.startsWith\("\/app\/documents\/"\)/);

console.log("verify-eh131-health-navigation: all checks passed");
