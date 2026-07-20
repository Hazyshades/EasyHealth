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

test("EH103-UI-01 [LAB-PROVENANCE] traces a result to its raw source", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-PROVENANCE");
  await openSeededDocument(page, "LAB-PROVENANCE");

  await expect(page.getByText("Glucose", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/5\.6 mmol\/L.*ref 3\.9.*5\.5/).first()).toBeVisible();
  await selectSourceText(page, fixture.sourceText);
  await expect(page.getByText("Page 1 / 1", { exact: true })).toBeVisible();
});

test("EH103-UI-02 [LAB-PROVENANCE] retains raw evidence after acceptance and refresh", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-PROVENANCE");
  await openSeededDocument(page, "LAB-PROVENANCE");
  await acceptSelectedGlucoseIfAvailable(page);
  await refreshSeededDocument(page, "LAB-PROVENANCE");

  await selectSourceText(page, fixture.sourceText);
  await expect(page.getByText(/5\.6 mmol\/L.*ref 3\.9.*5\.5/).first()).toBeVisible();
});

test("EH103-UI-03 [LAB-PROVENANCE] keeps source evidence coherent after reprocess UI", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-PROVENANCE");
  await openSeededDocument(page, "LAB-PROVENANCE");
  await mockReprocess(page, "LAB-PROVENANCE");
  await page.getByRole("button", { name: "Reprocess", exact: true }).click();

  await expect(page.getByText("Glucose", { exact: true }).first()).toBeVisible();
  await selectSourceText(page, fixture.sourceText);
});

test("EH103-UI-04 [LAB-PROVENANCE-PARTIAL] retains raw evidence without false identity", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-PROVENANCE-PARTIAL");
  await openSeededDocument(page, "LAB-PROVENANCE-PARTIAL");
  await selectSourceText(page, fixture.sourceText);

  await openBiomarkers(page);
  await page.getByLabel("Search biomarkers").fill("E2E provenance partial source");
  await expect(page.getByText("No biomarkers match your filters.", { exact: true })).toBeVisible();

  await openHealthProfile(page);
  await expect(page.getByText("E2E provenance partial source", { exact: true })).toHaveCount(0);
});
