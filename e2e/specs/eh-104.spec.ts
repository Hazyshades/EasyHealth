import { expect, test } from "@playwright/test";
import {
  acceptSelectedGlucoseIfAvailable,
  attachFailureDiagnostics,
  mockReprocess,
  openBiomarkers,
  openHealthProfile,
  openSeededDocument,
  refreshSeededDocument,
  selectSourceText,
} from "../support/browser";
import { getFixtureDocument } from "../support/fixtures";
import { readRunContext } from "../support/ownership";

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureDiagnostics(page, testInfo);
});

test("EH104-UI-01 [LAB-RESOLVED] keeps reviewed source, document, and biomarker views consistent", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-RESOLVED");
  await openSeededDocument(page, "LAB-RESOLVED");
  await acceptSelectedGlucoseIfAvailable(page);
  await refreshSeededDocument(page, "LAB-RESOLVED");
  await selectSourceText(page, fixture.sourceText);

  await openBiomarkers(page);
  const rows = page.locator("table tbody tr").filter({ hasText: "2025-02-15" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Glucose");
  await expect(rows).toContainText("5.4 mmol/L");
  await expect(rows).toContainText("Normal");
});

test("EH104-UI-02 [LAB-NOT-RESOLVED] does not turn non-resolved evidence into a trend", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-NOT-RESOLVED");
  await openSeededDocument(page, "LAB-NOT-RESOLVED");
  await selectSourceText(page, fixture.sourceText);

  await openBiomarkers(page);
  await page.getByLabel("Search biomarkers").fill("E2E unrecognized laboratory source");
  await expect(page.getByText("No biomarkers match your filters.", { exact: true })).toBeVisible();

  await openHealthProfile(page);
  await expect(page.getByText("E2E unrecognized laboratory source", { exact: true })).toHaveCount(0);
});

test("EH104-UI-03 [LAB-RESOLVED] presents a coherent deterministic reprocess result", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-RESOLVED");
  await openSeededDocument(page, "LAB-RESOLVED");
  await mockReprocess(page, "LAB-RESOLVED");
  await page.getByRole("button", { name: "Reprocess", exact: true }).click();

  await expect(page.getByText("LAB-RESOLVED.png", { exact: true })).toBeVisible();
  await expect(page.getByText("Glucose", { exact: true }).first()).toBeVisible();
  await selectSourceText(page, fixture.sourceText);
});
