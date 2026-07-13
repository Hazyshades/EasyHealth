import { buildNebiusEnvConfig, configuredNebiusModelIds } from "@/lib/ai/nebius-config";

let catalogIds: Set<string> | null = null;
let catalogValidated = false;

export async function fetchNebiusModelCatalogIds(): Promise<Set<string>> {
  const config = buildNebiusEnvConfig();
  if (!config.apiKey) return new Set();

  const base = config.baseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/models?verbose=true`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Nebius model catalog request failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { data?: Array<{ id?: string }> };
  const ids = new Set<string>();
  for (const row of payload.data ?? []) {
    if (row.id) ids.add(row.id);
  }
  return ids;
}

export async function validateNebiusModelCatalog(options?: {
  failInProduction?: boolean;
}): Promise<void> {
  if (catalogValidated) return;

  const config = buildNebiusEnvConfig();
  if (!config.apiKey) {
    catalogValidated = true;
    return;
  }

  const failInProduction =
    options?.failInProduction ?? process.env.NODE_ENV === "production";

  try {
    catalogIds = await fetchNebiusModelCatalogIds();
    const required = configuredNebiusModelIds(config);
    const missing = required.filter((id) => !catalogIds!.has(id));

    if (missing.length > 0) {
      const message = `Nebius model catalog missing configured IDs: ${missing.join(", ")}`;
      if (failInProduction) {
        throw new Error(message);
      }
      console.warn(`[nebius] ${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (failInProduction) throw error;
    console.warn(`[nebius] Model catalog validation skipped: ${message}`);
  }

  catalogValidated = true;
}

export function getNebiusCatalogIds(): Set<string> {
  return catalogIds ?? new Set();
}
