import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import {
  parsePdfBboxLayout,
  splitPlainTextPages,
  type PdfLayoutPage,
} from "../../src/lib/documents/pdf-text-layout.js";

const execFileAsync = promisify(execFile);

function popplerExecutable(name: "pdftoppm" | "pdftotext"): string {
  const binDir = process.env.POPPLER_BIN_DIR?.trim();
  if (binDir) {
    const exe = process.platform === "win32" ? `${name}.exe` : name;
    return join(binDir, exe);
  }
  return name;
}

function popplerMissingMessage(tool: string): string {
  return (
    `${tool} not found. Install poppler-utils (Linux/Docker) or on Windows run ` +
    "winget install oschwartz10612.Poppler and add its Library/bin folder to PATH, " +
    "or set POPPLER_BIN_DIR in worker .env. " +
    "Note: choco install poppler ships source only — it does not include pdftoppm.exe."
  );
}

export type GeneratedPage = {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
};

const PREVIEW_WIDTH = 1600;
const THUMB_WIDTH = 320;

async function renderPdfPages(pdfPath: string): Promise<GeneratedPage[]> {
  const dir = await mkdtemp(join(tmpdir(), "eh-pages-"));
  try {
    const outPrefix = join(dir, "page");
    const pdftoppm = popplerExecutable("pdftoppm");
    try {
      await execFileAsync(pdftoppm, ["-png", "-r", "150", pdfPath, outPrefix]);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") {
        throw new Error(popplerMissingMessage("pdftoppm"));
      }
      throw error;
    }
    const files = (await readdir(dir))
      .filter((f) => f.endsWith(".png"))
      .sort();

    const pages: GeneratedPage[] = [];
    for (let i = 0; i < files.length; i++) {
      const pngPath = join(dir, files[i]);
      const pngBuffer = await readFile(pngPath);
      const webp = await sharp(pngBuffer)
        .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      const meta = await sharp(webp).metadata();
      pages.push({
        pageNumber: i + 1,
        buffer: webp,
        width: meta.width ?? PREVIEW_WIDTH,
        height: meta.height ?? 0,
      });
    }
    return pages;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function renderImagePage(buffer: Buffer): Promise<GeneratedPage> {
  const webp = await sharp(buffer)
    .rotate()
    .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  const meta = await sharp(webp).metadata();
  return {
    pageNumber: 1,
    buffer: webp,
    width: meta.width ?? PREVIEW_WIDTH,
    height: meta.height ?? 0,
  };
}

export async function generatePagePreviews(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<GeneratedPage[]> {
  const isPdf = mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
  if (isPdf) {
    const dir = await mkdtemp(join(tmpdir(), "eh-pdf-"));
    try {
      const pdfPath = join(dir, "input.pdf");
      await writeFile(pdfPath, buffer);
      return await renderPdfPages(pdfPath);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
  return [await renderImagePage(buffer)];
}

export async function generateThumbnail(pageBuffer: Buffer): Promise<Buffer> {
  return sharp(pageBuffer)
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * EH-118: extract the PDF page index with word geometry.
 *
 * `-bbox-layout` gives per-word rectangles in PDF user space, which is the only
 * deterministic source of source-region coordinates available to this worker.
 * When it yields nothing (scanned pages, older poppler, malformed PDF) the
 * plain text extractor still supplies per-page text, so page-level provenance
 * survives and only the region highlight degrades.
 */
export async function extractPdfPageIndex(buffer: Buffer): Promise<PdfLayoutPage[]> {
  const dir = await mkdtemp(join(tmpdir(), "eh-ocr-"));
  try {
    const pdfPath = join(dir, "input.pdf");
    await writeFile(pdfPath, buffer);
    const pdftotext = popplerExecutable("pdftotext");

    try {
      const layoutPath = join(dir, "layout.xhtml");
      await execFileAsync(pdftotext, ["-bbox-layout", "-enc", "UTF-8", pdfPath, layoutPath]);
      const pages = parsePdfBboxLayout(await readFile(layoutPath, "utf-8"));
      if (pages.some((page) => page.lines.length > 0)) return pages;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === "ENOENT") throw new Error(popplerMissingMessage("pdftotext"));
      console.warn("[previews] pdftotext -bbox-layout failed, falling back to plain text");
    }

    const txtPath = join(dir, "output.txt");
    await execFileAsync(pdftotext, ["-enc", "UTF-8", pdfPath, txtPath]);
    return splitPlainTextPages(await readFile(txtPath, "utf-8")).map((text, index) => ({
      page_number: index + 1,
      width: 0,
      height: 0,
      text,
      lines: [],
    }));
  } catch {
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
