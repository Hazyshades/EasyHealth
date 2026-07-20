import { expect, test } from "@playwright/test";
import {
  attachFailureDiagnostics,
  openBiomarkers,
  openSeededDocument,
  selectSourceText,
} from "../support/browser";
import { getFixtureDocument } from "../support/fixtures";
import { readRunContext } from "../support/ownership";

test.afterEach(async ({ page }, testInfo) => {
  await attachFailureDiagnostics(page, testInfo);
});

test("EH101-UI-01 [LAB-BASELINE] keeps seeded baseline values readable", async ({ page }) => {
  await openSeededDocument(page, "LAB-BASELINE");

  const glucoseCard = page.locator("li").filter({ has: page.getByText("Glucose", { exact: true }) }).first();
  await expect(glucoseCard.getByText("Glucose", { exact: true })).toBeVisible();
  await expect(glucoseCard.getByText("5.2 mmol/L · ref 3.9–5.5", { exact: true })).toBeVisible();
  await expect(page.getByText(/Lab date 2025-01-15/, { exact: false })).toBeVisible();
});

test("EH101-UI-02 [LAB-BASELINE] selects the matching source evidence", async ({ page }) => {
  const fixture = getFixtureDocument(readRunContext(), "LAB-BASELINE");
  await openSeededDocument(page, "LAB-BASELINE");

  await selectSourceText(page, fixture.sourceText);
  await expect(page.getByText("Page 1 / 1", { exact: true })).toBeVisible();
});

test("EH101-UI-03 [LAB-BASELINE] keeps biomarker history stable after refresh", async ({ page }) => {
  await openBiomarkers(page);
  const rows = page.locator("table tbody tr").filter({ hasText: "2025-01-15" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Glucose");
  await expect(rows).toContainText("5.2 mmol/L");
  await expect(rows).toContainText("2025-01-15");
  await expect(rows).toContainText("Normal");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Glucose");
  await expect(rows).toContainText("5.2 mmol/L");
  await expect(rows).toContainText("2025-01-15");
  await expect(rows).toContainText("Normal");
});
