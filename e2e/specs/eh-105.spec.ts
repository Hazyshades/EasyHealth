import { expect, test } from "@playwright/test";
import {
  SYNTHETIC_UPLOAD,
  attachFailureDiagnostics,
  mockReprocess,
  mockUploadToFixture,
  openBiomarkers,
  openHealthProfile,
  openSeededDocument,
  refreshSeededDocument,
  setFixtureReady,
} from "../support/browser";
import { getFixtureDocument } from "../support/fixtures";
import { readRunContext } from "../support/ownership";

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureDiagnostics(page, testInfo);
});

test("EH105-UI-01 [INST-NORMAL] displays instrumental findings through the upload UI", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "INST-NORMAL");
  const finding = "E2E normal finding: no focal synthetic abnormality.";
  await mockUploadToFixture(page, "INST-NORMAL");
  await page.goto("/app/upload?type=instrumental_report", { waitUntil: "domcontentloaded" });
  await page.locator("#upload-instrumental_report").setInputFiles(SYNTHETIC_UPLOAD);

  await expect(page).toHaveURL(new RegExp(`/app/documents/${fixture.id}$`));
  await expect(page.getByRole("heading", { name: "Study findings" })).toBeVisible();
  await expect(page.getByText(finding, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Extracted biomarkers" })).toHaveCount(0);
  await page.getByRole("button", { name: new RegExp(finding) }).click();
  await expect(page.getByText(`Source: ${finding}`, { exact: true })).toBeVisible();
});

test("EH105-UI-02 [INST-NORMAL] preserves normal findings through reprocess UI", async ({ page }) => {
  await openSeededDocument(page, "INST-NORMAL");
  await mockReprocess(page, "INST-NORMAL");
  await page.getByRole("button", { name: "Reprocess", exact: true }).click();
  await refreshSeededDocument(page, "INST-NORMAL");

  await expect(page.getByText("E2E normal finding: no focal synthetic abnormality.", { exact: true })).toHaveCount(1);
  await expect(page.getByText("E2E normal finding: synthetic study detail retained.", { exact: true })).toHaveCount(1);
});

test("EH105-UI-03 [INST-REPEAT] keeps repeated-looking findings distinct after reprocess UI", async ({ page }) => {
  await openSeededDocument(page, "INST-REPEAT");
  await expect(page.getByText("E2E repeated finding A: 8 mm synthetic focus, source occurrence 1.", { exact: true })).toHaveCount(1);
  await expect(page.getByText("E2E repeated finding B: 8 mm synthetic focus, source occurrence 2.", { exact: true })).toHaveCount(1);

  await mockReprocess(page, "INST-REPEAT");
  await page.getByRole("button", { name: "Reprocess", exact: true }).click();
  await refreshSeededDocument(page, "INST-REPEAT");
  await expect(page.getByText("E2E repeated finding A: 8 mm synthetic focus, source occurrence 1.", { exact: true })).toHaveCount(1);
  await expect(page.getByText("E2E repeated finding B: 8 mm synthetic focus, source occurrence 2.", { exact: true })).toHaveCount(1);
});

test("EH105-UI-04 [INST-NORMAL] does not add a laboratory assessment point", async ({ page }) => {
  await openBiomarkers(page);
  const glucoseRows = page.locator("table tbody tr").filter({ hasText: "Glucose" });
  await expect(glucoseRows.first()).toBeVisible();
  const rowsBeforeInstrumentalView = await glucoseRows.count();
  expect(rowsBeforeInstrumentalView).toBeGreaterThan(0);

  await openSeededDocument(page, "INST-NORMAL");
  await openBiomarkers(page);
  await expect(glucoseRows).toHaveCount(rowsBeforeInstrumentalView);

  await openHealthProfile(page);
  await expect(page.getByText("E2E instrumental measure 1", { exact: true })).toHaveCount(0);
});

test("EH105-UI-05 [INST-FAILURE] exposes and recovers a controlled failed-processing state", async ({ page }) => {
  await openSeededDocument(page, "INST-FAILURE");
  await expect(page.getByText("failed", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("E2E synthetic recoverable processing fault", { exact: true })).toBeVisible();
  await refreshSeededDocument(page, "INST-FAILURE");
  await expect(page.getByText("failed", { exact: true }).first()).toBeVisible();

  // This is a fixture state transition, not a worker assertion. The browser
  // still exercises the real reprocess control and deterministic response.
  await setFixtureReady("INST-FAILURE");
  await mockReprocess(page, "INST-FAILURE");
  await page.getByRole("button", { name: "Reprocess", exact: true }).click();

  await expect(page.getByText("ready", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("E2E synthetic recoverable processing fault", { exact: true })).toHaveCount(0);
  await expect(page.getByText("No structured findings detected in this report.", { exact: true })).toBeVisible();
});
