/**
 * Versioned page OCR artifact contracts.
 *
 * Schema-v1 remains readable for existing Poppler artifacts. Schema-v2 adds
 * provider/model/source identity and normalized page metadata for external OCR.
 */

export type OcrBbox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PageOcrBlock = {
  text: string;
  confidence?: number | null;
  bbox?: OcrBbox | null;
};

export type PageOcrArtifactV1 = {
  schema_version: 1;
  engine: string;
  page_number: number;
  width?: number;
  height?: number;
  full_text: string;
  blocks?: PageOcrBlock[];
  coordinate_space?: "normalized" | "pixel";
  created_at: string;
};

export type PageOcrArtifactV2 = {
  schema_version: 2;
  provider: "poppler" | "mistral";
  engine: string;
  model: string | null;
  adapter_version: string;
  source_sha256: string;
  page_number: number;
  width: number | null;
  height: number | null;
  full_text: string;
  markdown: string;
  blocks: PageOcrBlock[];
  coordinate_space: "normalized";
  origin: "top-left";
  created_at: string;
};

export type PageOcrArtifact = PageOcrArtifactV1 | PageOcrArtifactV2;

export function buildPageOcrArtifact(input: {
  engine: string;
  page_number: number;
  full_text: string;
  width?: number;
  height?: number;
  blocks?: PageOcrBlock[];
  coordinate_space?: "normalized" | "pixel";
}): PageOcrArtifactV1 {
  return {
    schema_version: 1,
    engine: input.engine,
    page_number: input.page_number,
    width: input.width,
    height: input.height,
    full_text: input.full_text,
    blocks: input.blocks,
    coordinate_space: input.coordinate_space,
    created_at: new Date().toISOString(),
  };
}

export function buildPageOcrArtifactV2(input: {
  provider: "poppler" | "mistral";
  engine: string;
  model: string | null;
  adapter_version: string;
  source_sha256: string;
  page_number: number;
  width: number | null;
  height: number | null;
  full_text: string;
  markdown: string;
  blocks: PageOcrBlock[];
  created_at?: string;
}): PageOcrArtifactV2 {
  return {
    schema_version: 2,
    provider: input.provider,
    engine: input.engine,
    model: input.model,
    adapter_version: input.adapter_version,
    source_sha256: input.source_sha256,
    page_number: input.page_number,
    width: input.width,
    height: input.height,
    full_text: input.full_text,
    markdown: input.markdown,
    blocks: input.blocks,
    coordinate_space: "normalized",
    origin: "top-left",
    created_at: input.created_at ?? new Date().toISOString(),
  };
}

export function isPageOcrArtifact(value: unknown): value is PageOcrArtifact {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (
    v.schema_version === 1 &&
    typeof v.engine === "string" &&
    typeof v.page_number === "number" &&
    typeof v.full_text === "string"
  ) {
    return true;
  }
  return (
    v.schema_version === 2 &&
    (v.provider === "poppler" || v.provider === "mistral") &&
    typeof v.engine === "string" &&
    (typeof v.model === "string" || v.model === null) &&
    typeof v.adapter_version === "string" &&
    typeof v.source_sha256 === "string" &&
    typeof v.page_number === "number" &&
    (typeof v.width === "number" || v.width === null) &&
    (typeof v.height === "number" || v.height === null) &&
    typeof v.full_text === "string" &&
    typeof v.markdown === "string" &&
    Array.isArray(v.blocks) &&
    v.coordinate_space === "normalized" &&
    v.origin === "top-left" &&
    typeof v.created_at === "string"
  );
}
