import { expect, test } from "@playwright/test";
import {
  SYNTHETIC_UPLOAD,
  acceptSelectedGlucoseIfAvailable,
  attachFailureDiagnostics,
  mockUploadToFixture,
  openBiomarkers,
  openHealthProfile,
  openSeededDocument,
  selectSourceText,
} from "../support/browser";
import { getFixtureDocument } from "../support/fixtures";
import { SAFETY_STORAGE_STATE, readRunContext } from "../support/ownership";

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureDiagnostics(page, testInfo);
});

test("EH102-UI-01 [LAB-RESOLVED] shows resolved source evidence through the upload UI", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-RESOLVED");
  await mockUploadToFixture(page, "LAB-RESOLVED");
  await page.goto("/app/upload?type=lab_result", { waitUntil: "domcontentloaded" });
  await page.locator("#upload-lab_result").setInputFiles(SYNTHETIC_UPLOAD);

  await expect(page.getByText("Document queued for processing", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/documents/${fixture.id}$`));
  await expect(page.getByText(/5\.4 mmol\/L.*ref 3\.9.*5\.5/).first()).toBeVisible();
  await selectSourceText(page, fixture.sourceText);
});

test("EH102-UI-02 [LAB-RESOLVED] shows reviewed resolved data in Biomarkers", async ({ page }) => {
  await openSeededDocument(page, "LAB-RESOLVED");
  await acceptSelectedGlucoseIfAvailable(page);
  await openBiomarkers(page);

  const rows = page.locator("table tbody tr").filter({ hasText: "2025-02-15" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Glucose");
  await expect(rows).toContainText("5.4 mmol/L");
  await expect(rows).toContainText(/3\.9.{0,3}5\.5/);
  await expect(rows).toContainText("Normal");
});

test("EH102-UI-03 [LAB-PARTIAL] keeps incomplete evidence out of trusted views", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-PARTIAL");
  await openSeededDocument(page, "LAB-PARTIAL");
  await selectSourceText(page, fixture.sourceText);

  await openBiomarkers(page);
  await page.getByLabel("Search biomarkers").fill("E2E partial glucose source");
  await expect(page.getByText("No biomarkers match your filters.", { exact: true })).toBeVisible();

  await openHealthProfile(page);
  await expect(page.getByText("E2E partial glucose source", { exact: true })).toHaveCount(0);
});

test("EH102-UI-04 [LAB-AMBIGUOUS] keeps ambiguous evidence out of trusted views", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-AMBIGUOUS");
  await openSeededDocument(page, "LAB-AMBIGUOUS");
  await selectSourceText(page, fixture.sourceText);

  await openBiomarkers(page);
  await page.getByLabel("Search biomarkers").fill("E2E ambiguous glucose source");
  await expect(page.getByText("No biomarkers match your filters.", { exact: true })).toBeVisible();

  await openHealthProfile(page);
  await expect(page.getByText("E2E ambiguous glucose source", { exact: true })).toHaveCount(0);
});

test.describe("incomplete-only safety account", () => {
  test.use({ storageState: SAFETY_STORAGE_STATE });

  test("EH102-UI-05 [SAFETY-LAB-PARTIAL] explains an empty resolved trend safely", async ({ page }) => {
    await openBiomarkers(page);
    await expect(page.getByText("No biomarkers match your filters.", { exact: true })).toBeVisible();
    await expect(page.getByText("No resolved measurement definitions are available for trends yet.", { exact: true })).toBeVisible();

    await openHealthProfile(page);
    await expect(page.getByRole("heading", { name: "No recognized lab markers yet" })).toBeVisible();
  });
});
