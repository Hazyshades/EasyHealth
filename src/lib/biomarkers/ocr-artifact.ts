/**
 * Versioned page OCR artifact contract (design D5).
 * Stored at document_pages.ocr_json_storage_path when used.
 */

export type OcrBbox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PageOcrBlock = {
  text: string;
  confidence?: number;
  bbox?: OcrBbox;
};

export type PageOcrArtifact = {
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

export function buildPageOcrArtifact(input: {
  engine: string;
  page_number: number;
  full_text: string;
  width?: number;
  height?: number;
  blocks?: PageOcrBlock[];
  coordinate_space?: "normalized" | "pixel";
}): PageOcrArtifact {
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

export function isPageOcrArtifact(value: unknown): value is PageOcrArtifact {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    v.schema_version === 1 &&
    typeof v.engine === "string" &&
    typeof v.page_number === "number" &&
    typeof v.full_text === "string"
  );
}
