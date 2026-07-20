import { expect, type Page, type TestInfo } from "@playwright/test";
import { getFixtureDocument, setFixtureDocumentState, type FixtureName } from "./fixtures";
import { loadE2EEnvironment } from "./env";
import { readRunContext } from "./ownership";
import { createE2EAdminClient } from "./supabase";
import { refreshCachedSyntheses } from "./synthesis-cache";

export const SYNTHETIC_UPLOAD = {
  name: "e2e-synthetic.png",
  mimeType: "image/png",
  buffer: Buffer.from("e2e-synthetic-upload"),
};

export async function openSeededDocument(page: Page, fixture: FixtureName): Promise<void> {
  const document = getFixtureDocument(readRunContext(), fixture);
  await page.goto(`/app/documents/${document.id}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(`${fixture}.png`, { exact: true })).toBeVisible({ timeout: 15_000 });
}

export async function refreshSeededDocument(page: Page, fixture: FixtureName): Promise<void> {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(`${fixture}.png`, { exact: true })).toBeVisible({ timeout: 15_000 });
}

export async function openBiomarkers(page: Page): Promise<void> {
  await page.goto("/app/biomarkers", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: /biomarkers/i })).toBeVisible();
}

export async function openHealthProfile(page: Page): Promise<void> {
  await page.goto("/app/profile", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(/loading health profile/i)).toHaveCount(0, { timeout: 15_000 });
}

export async function selectSourceText(page: Page, sourceText: string): Promise<void> {
  // The review list intentionally truncates long source excerpts. Clicking the
  // visible prefix exercises the real selector; the full text is asserted in
  // the viewer's active-source area afterwards.
  await page.getByText(sourceText.slice(0, 60), { exact: false }).first().click();
  await expect(page.getByText(`Source: ${sourceText}`, { exact: true })).toBeVisible();
}

export async function acceptSelectedGlucoseIfAvailable(page: Page): Promise<void> {
  const checkbox = page.getByRole("checkbox", { name: /select glucose/i }).first();
  if (await checkbox.count()) {
    await checkbox.check();
    const accept = page.getByRole("button", { name: /accept selected \(1\)/i });
    await expect(accept).toBeEnabled();
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/documents\/[^/]+\/biomarkers\/accept(?:\?|$)/.test(new URL(response.url()).pathname),
    );
    await accept.click();
    const response = await responsePromise;
    if (!response.ok()) {
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const message = typeof payload?.error === "string" ? payload.error.slice(0, 500) : "no error message";
      throw new Error(`Accept request failed with ${response.status()}: ${message}`);
    }
    await expect(page.getByText(/accepted/i).first()).toBeVisible();
    const env = loadE2EEnvironment();
    const context = readRunContext();
    await refreshCachedSyntheses(createE2EAdminClient(env), context);
  }
}

export async function mockUploadToFixture(page: Page, fixture: FixtureName): Promise<void> {
  const document = getFixtureDocument(readRunContext(), fixture);
  await page.route("**/api/upload", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documentId: document.id }) });
  });
}

export async function mockReprocess(page: Page, fixture: FixtureName): Promise<void> {
  const document = getFixtureDocument(readRunContext(), fixture);
  await page.route(`**/api/documents/${document.id}/reprocess`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, processingStatus: "processing" }),
    });
  });
}

export async function setFixtureReady(fixture: FixtureName): Promise<void> {
  const env = loadE2EEnvironment();
  const context = readRunContext();
  await setFixtureDocumentState(createE2EAdminClient(env), context, fixture, {
    status: "completed",
    processing_status: "ready",
    processing_error: null,
  });
  await refreshCachedSyntheses(createE2EAdminClient(env), context);
}

export async function attachFailureDiagnostics(page: Page, testInfo: TestInfo): Promise<void> {
  if (testInfo.status === testInfo.expectedStatus) return;
  const checklistId = testInfo.title.match(/EH\d{3}-UI-\d{2}/)?.[0] ?? "unmapped";
  const fixture = testInfo.title.match(/\[([A-Z0-9-]+)\]/)?.[1] ?? "unknown";
  let pathname = "unavailable";
  try {
    pathname = new URL(page.url()).pathname;
  } catch {
    // A page URL is diagnostic-only; avoid attaching an unexpected full URL.
  }
  await testInfo.attach("e2e-checklist-context", {
    body: JSON.stringify({ checklistId, fixture, pathname }, null, 2),
    contentType: "application/json",
  });
}
