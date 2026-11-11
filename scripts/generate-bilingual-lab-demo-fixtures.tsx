import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import React from "react";
import type {
  Document as PdfDocument,
  Font as PdfFont,
  Page as PdfPage,
  StyleSheet as PdfStyleSheet,
  Styles as PdfStyles,
  Text as PdfText,
  View as PdfView,
  renderToBuffer as pdfRenderToBuffer,
} from "@react-pdf/renderer";
import {
  BILINGUAL_LAB_DEMO_DATES,
  BILINGUAL_LAB_DEMO_MEASUREMENTS,
  BILINGUAL_LAB_DEMO_METADATA,
  BILINGUAL_LAB_DEMO_PANEL_LABELS,
  type BilingualLabDemoDate,
  type BilingualLabDemoLanguage,
  type BilingualLabDemoMeasurement,
  type BilingualLabDemoPanel,
  validateBilingualLabDemoManifest,
} from "./fixtures/bilingual-lab-demo-fixtures";

type PdfRenderer = {
  Document: typeof PdfDocument;
  Font: typeof PdfFont;
  Page: typeof PdfPage;
  StyleSheet: typeof PdfStyleSheet;
  Text: typeof PdfText;
  View: typeof PdfView;
  renderToBuffer: typeof pdfRenderToBuffer;
};

type FixtureOutput = {
  readonly relativePath: string;
  readonly language: BilingualLabDemoLanguage;
  readonly dates: readonly BilingualLabDemoDate[];
};

type RenderedOutput = FixtureOutput & {
  readonly hash: string;
  readonly byteLength: number;
};

const ROOT = process.cwd();
const FONT_FAMILY = "EasyHealthBilingualLabDemo";
const FONT_PATH = path.join(
  ROOT,
  "src",
  "lib",
  "report-export",
  "assets",
  "DejaVuSans.ttf",
);
const GENERATOR_VERSION = "BILINGUAL_LAB_DEMO_GENERATOR_V1";
const PDF_FONT_SUBSET_SUFFIX = Buffer.from("+DejaVuSans", "ascii");
const PDF_FONT_SUBSET_TAG = "EH153B";
const FIXED_CREATION_DATE = new Date("2026-11-01T12:00:00.000Z");
const ORIGINAL_PATH = "lab_data/chile/original.pdf";
const OUTPUTS: readonly FixtureOutput[] = [
  {
    relativePath: ORIGINAL_PATH,
    language: "es",
    dates: BILINGUAL_LAB_DEMO_DATES,
  },
  {
    relativePath: "lab_data/chile/baseline-es-2026-08-01.pdf",
    language: "es",
    dates: ["2026-08-01"],
  },
  {
    relativePath: "lab_data/chile/follow-up-es-2026-09-15.pdf",
    language: "es",
    dates: ["2026-09-15"],
  },
  {
    relativePath: "lab_data/chile/follow-up-es-2026-11-01.pdf",
    language: "es",
    dates: ["2026-11-01"],
  },
  {
    relativePath: "lab_data/chile/en/original.pdf",
    language: "en",
    dates: BILINGUAL_LAB_DEMO_DATES,
  },
  {
    relativePath: "lab_data/chile/en/baseline-en-2026-08-01.pdf",
    language: "en",
    dates: ["2026-08-01"],
  },
  {
    relativePath: "lab_data/chile/en/follow-up-en-2026-09-15.pdf",
    language: "en",
    dates: ["2026-09-15"],
  },
  {
    relativePath: "lab_data/chile/en/follow-up-en-2026-11-01.pdf",
    language: "en",
    dates: ["2026-11-01"],
  },
];

const PANELS: readonly BilingualLabDemoPanel[] = [
  "lipid",
  "metabolic",
  "thyroid",
  "liver",
  "kidney",
  "cbc",
  "iron",
  "nutrients",
  "inflammation",
];

const stylesDefinition = {
  page: {
    paddingTop: 126,
    paddingBottom: 38,
    paddingHorizontal: 24,
    fontFamily: FONT_FAMILY,
    fontSize: 6.5,
    lineHeight: 1.25,
    color: "#111827",
  },
  header: {
    position: "absolute",
    top: 24,
    left: 24,
    right: 24,
  },
  title: {
    fontSize: 14,
    lineHeight: 1.15,
    marginBottom: 3,
  },
  metadata: {
    fontSize: 6.5,
    color: "#374151",
    marginBottom: 5,
  },
  banner: {
    padding: 5,
    marginBottom: 6,
    backgroundColor: "#fef3c7",
    border: "0.8pt solid #b45309",
  },
  bannerText: {
    fontSize: 7,
    color: "#92400e",
  },
  tableHeader: {
    position: "absolute",
    top: 94,
    left: 24,
    right: 24,
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 3,
    backgroundColor: "#e5e7eb",
    borderBottom: "0.8pt solid #6b7280",
    fontSize: 5.8,
    fontWeight: 700,
  },
  panel: {
    marginBottom: 7,
  },
  panelTitle: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    marginBottom: 2,
    backgroundColor: "#dbeafe",
    color: "#1e3a8a",
    fontSize: 8,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottom: "0.35pt solid #d1d5db",
  },
  label: { flex: 3 },
  result: { flex: 0.9 },
  unit: { flex: 1.2 },
  reference: { flex: 1.35 },
  specimen: { flex: 0.9 },
  method: { flex: 0.9 },
  modifier: { flex: 0.8 },
  date: { flex: 1.1 },
  footer: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 18,
    paddingTop: 4,
    borderTop: "0.6pt solid #9ca3af",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#4b5563",
    fontSize: 6,
  },
  disclaimer: {
    marginTop: 8,
    paddingTop: 5,
    borderTop: "0.6pt solid #9ca3af",
    color: "#92400e",
    fontSize: 6.2,
  },
} as const;

function normalizePdfFontSubsetTags(bytes: Uint8Array): Uint8Array {
  const normalized = Buffer.from(bytes);
  let offset = 0;
  while (offset <= normalized.length) {
    const suffixIndex = normalized.indexOf(PDF_FONT_SUBSET_SUFFIX, offset);
    if (suffixIndex < 0) break;
    const tagStart = suffixIndex - 6;
    const tag = normalized.subarray(Math.max(0, tagStart), suffixIndex);
    if (tagStart >= 6 && tag.every((byte) => byte >= 65 && byte <= 90)) {
      normalized.write(PDF_FONT_SUBSET_TAG, tagStart, 6, "ascii");
    }
    offset = suffixIndex + PDF_FONT_SUBSET_SUFFIX.length;
  }
  return new Uint8Array(normalized);
}

function outputSubject(output: FixtureOutput): string {
  return [
    GENERATOR_VERSION,
    `language=${output.language}`,
    `dates=${output.dates.join(",")}`,
    `path=${output.relativePath}`,
  ].join("|");
}

function rowsFor(
  dates: readonly BilingualLabDemoDate[],
  panel: BilingualLabDemoPanel,
): Array<{
  measurement: BilingualLabDemoMeasurement;
  date: BilingualLabDemoDate;
}> {
  return dates.flatMap((date) =>
    BILINGUAL_LAB_DEMO_MEASUREMENTS.filter(
      (measurement) => measurement.panel === panel,
    ).map((measurement) => ({ measurement, date })),
  );
}

function LabDemoPdfDocument({
  output,
  renderer,
}: {
  output: FixtureOutput;
  renderer: PdfRenderer;
}) {
  const { Document, Page, Text, View } = renderer;
  const styles = renderer.StyleSheet.create(stylesDefinition);
  const language = output.language;
  const isMultiDate = output.dates.length > 1;
  return (
    <Document
      title={BILINGUAL_LAB_DEMO_METADATA.reportTitle[language]}
      author={BILINGUAL_LAB_DEMO_METADATA.laboratory}
      subject={outputSubject(output)}
      creator={GENERATOR_VERSION}
      producer={GENERATOR_VERSION}
      creationDate={FIXED_CREATION_DATE}
    >
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={styles.header}>
          <Text style={styles.title}>
            {BILINGUAL_LAB_DEMO_METADATA.reportTitle[language]}
          </Text>
          <Text style={styles.metadata}>
            Laboratory: {BILINGUAL_LAB_DEMO_METADATA.laboratory} · Patient:{" "}
            {BILINGUAL_LAB_DEMO_METADATA.patientName} · ID:{" "}
            {BILINGUAL_LAB_DEMO_METADATA.patientId}
          </Text>
          <Text style={styles.metadata}>
            {output.dates.length === BILINGUAL_LAB_DEMO_DATES.length
              ? `Collection dates: ${output.dates.join(", ")}`
              : `Collection date: ${output.dates[0]}`}{" "}
            · Language: {language === "es" ? "Español" : "English"}
          </Text>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {BILINGUAL_LAB_DEMO_METADATA.syntheticBanner[language]}
            </Text>
          </View>
        </View>
        <View fixed style={styles.tableHeader}>
          <Text style={styles.label}>
            {language === "es" ? "Prueba" : "Test"}
          </Text>
          <Text style={styles.result}>
            {language === "es" ? "Resultado" : "Result"}
          </Text>
          <Text style={styles.unit}>
            {language === "es" ? "Unidad" : "Unit"}
          </Text>
          <Text style={styles.reference}>
            {language === "es" ? "Referencia" : "Reference"}
          </Text>
          <Text style={styles.specimen}>
            {language === "es" ? "Muestra" : "Specimen"}
          </Text>
          <Text style={styles.method}>
            {language === "es" ? "Método" : "Method"}
          </Text>
          <Text style={styles.modifier}>
            {language === "es" ? "Mod." : "Mod."}
          </Text>
          <Text style={styles.date}>
            {language === "es" ? "Fecha" : "Date"}
          </Text>
        </View>
        {PANELS.map((panel) => {
          const rows = rowsFor(output.dates, panel);
          return (
            <View key={panel} style={styles.panel}>
              <Text style={styles.panelTitle} minPresenceAhead={18}>
                {BILINGUAL_LAB_DEMO_PANEL_LABELS[panel][language]}
              </Text>
              {rows.map(({ measurement, date }) => (
                <View
                  key={`${panel}-${measurement.definitionKey}-${date}`}
                  style={styles.row}
                  wrap={false}
                >
                  <Text style={styles.label}>
                    {measurement.labels[language]}
                  </Text>
                  <Text style={styles.result}>{measurement.values[date]}</Text>
                  <Text style={styles.unit}>{measurement.unit}</Text>
                  <Text style={styles.reference}>
                    {measurement.refLow} - {measurement.refHigh}
                  </Text>
                  <Text style={styles.specimen}>
                    {measurement.specimen.replace("_", " ")}
                  </Text>
                  <Text style={styles.method}>{measurement.method}</Text>
                  <Text style={styles.modifier}>
                    {measurement.modifier === "none"
                      ? "—"
                      : measurement.modifier}
                  </Text>
                  <Text style={styles.date}>{date}</Text>
                </View>
              ))}
            </View>
          );
        })}
        <Text style={styles.disclaimer}>
          {BILINGUAL_LAB_DEMO_METADATA.disclaimer[language]}{" "}
          {isMultiDate
            ? "Each row carries its collection date for extraction and history verification."
            : "This fixture is intended for extraction and product verification only."}
        </Text>
        <View fixed style={styles.footer}>
          <Text>
            {GENERATOR_VERSION} · Synthetic fixture · No clinical interpretation
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function verifyPdfBytes(bytes: Uint8Array, output: FixtureOutput): void {
  const text = Buffer.from(bytes).toString("latin1");
  if (!text.startsWith("%PDF-")) {
    throw new Error(`BILINGUAL_LAB_DEMO_PDF_INVALID: ${output.relativePath}`);
  }
  if (!text.includes("%%EOF")) {
    throw new Error(
      `BILINGUAL_LAB_DEMO_PDF_EOF_MISSING: ${output.relativePath}`,
    );
  }
  if (!text.includes(outputSubject(output))) {
    throw new Error(
      `BILINGUAL_LAB_DEMO_METADATA_MISSING: ${output.relativePath}`,
    );
  }
  if (bytes.byteLength < 500) {
    throw new Error(`BILINGUAL_LAB_DEMO_PDF_TOO_SMALL: ${output.relativePath}`);
  }
}

async function renderOutputs(
  renderer: PdfRenderer,
  stageDirectory: string,
): Promise<RenderedOutput[]> {
  const rendered: RenderedOutput[] = [];
  for (const output of OUTPUTS) {
    const bytes = normalizePdfFontSubsetTags(
      await renderer.renderToBuffer(
        <LabDemoPdfDocument output={output} renderer={renderer} />,
      ),
    );
    verifyPdfBytes(bytes, output);
    const stagePath = path.join(stageDirectory, output.relativePath);
    await fs.mkdir(path.dirname(stagePath), { recursive: true });
    await fs.writeFile(stagePath, bytes);
    rendered.push({
      ...output,
      hash: sha256(bytes),
      byteLength: bytes.byteLength,
    });
  }
  return rendered;
}

async function verifyExistingGeneratedTarget(
  targetPath: string,
): Promise<void> {
  const bytes = await fs.readFile(targetPath);
  const text = bytes.toString("latin1");
  if (!text.includes(GENERATOR_VERSION)) {
    throw new Error(
      `BILINGUAL_LAB_DEMO_REFUSE_OVERWRITE: ${path.relative(ROOT, targetPath)} is not marked as a generated synthetic fixture`,
    );
  }
}

async function publish(
  stageDirectory: string,
  replaceOriginal: boolean,
): Promise<void> {
  const backupDirectory = path.join(stageDirectory, "backups");
  const backups: Array<{ target: string; backup: string }> = [];
  const published: string[] = [];
  try {
    for (const output of OUTPUTS) {
      const target = path.join(ROOT, output.relativePath);
      if (await exists(target)) {
        if (output.relativePath === ORIGINAL_PATH) {
          if (!replaceOriginal) {
            throw new Error(
              `BILINGUAL_LAB_DEMO_ORIGINAL_EXISTS: ${output.relativePath} already exists; inspect it and rerun with --replace-original only when it is the intended synthetic Spanish multi-date fixture`,
            );
          }
        } else {
          await verifyExistingGeneratedTarget(target);
        }
        const backup = path.join(backupDirectory, output.relativePath);
        await fs.mkdir(path.dirname(backup), { recursive: true });
        await fs.rename(target, backup);
        backups.push({ target, backup });
      }
    }
    for (const output of OUTPUTS) {
      const target = path.join(ROOT, output.relativePath);
      const staged = path.join(stageDirectory, output.relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.rename(staged, target);
      published.push(target);
    }
    await fs.rm(backupDirectory, { recursive: true, force: true });
  } catch (error) {
    for (const target of published) {
      await fs.rm(target, { force: true });
    }
    for (const { target, backup } of backups.reverse()) {
      if (await exists(backup)) {
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.rename(backup, target);
      }
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const replaceOriginal = args.has("--replace-original");
  const stageOnly = args.has("--stage-only");
  const unknownArgs = [...args].filter(
    (arg) => arg !== "--replace-original" && arg !== "--stage-only",
  );
  if (unknownArgs.length > 0) {
    throw new Error(
      `BILINGUAL_LAB_DEMO_UNKNOWN_ARGUMENT: ${unknownArgs.join(", ")}`,
    );
  }

  validateBilingualLabDemoManifest();
  if (!(await exists(FONT_PATH))) {
    throw new Error(`BILINGUAL_LAB_DEMO_FONT_MISSING: ${FONT_PATH}`);
  }
  if (
    !stageOnly &&
    !replaceOriginal &&
    (await exists(path.join(ROOT, ORIGINAL_PATH)))
  ) {
    throw new Error(
      `BILINGUAL_LAB_DEMO_ORIGINAL_EXISTS: ${ORIGINAL_PATH} already exists; use --stage-only for non-destructive verification or --replace-original after inspection`,
    );
  }

  // Load the renderer dynamically to avoid its CommonJS hyphenation subpath resolution.
  const renderer = await import("@react-pdf/renderer");
  renderer.Font.register({ family: FONT_FAMILY, src: FONT_PATH });
  const stageRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "easyhealth-bilingual-lab-demo-"),
  );
  const firstStage = path.join(stageRoot, "first");
  const secondStage = path.join(stageRoot, "second");
  try {
    const first = await renderOutputs(renderer, firstStage);
    const second = await renderOutputs(renderer, secondStage);
    for (const [index, firstOutput] of first.entries()) {
      const secondOutput = second[index];
      if (
        firstOutput.relativePath !== secondOutput.relativePath ||
        firstOutput.hash !== secondOutput.hash
      ) {
        throw new Error(
          `BILINGUAL_LAB_DEMO_NONDETERMINISTIC: ${firstOutput.relativePath} ${firstOutput.hash} != ${secondOutput.hash}`,
        );
      }
    }
    if (stageOnly) {
      console.log(
        `bilingual-lab-demo: verified ${first.length} staged PDFs; hashes stable; publication skipped`,
      );
      return;
    }
    await publish(firstStage, replaceOriginal);
    console.log(
      `bilingual-lab-demo: published ${first.length} PDFs; hashes stable; originalReplacement=${replaceOriginal}`,
    );
    for (const output of first) {
      console.log(
        `${output.relativePath} ${output.hash} ${output.byteLength} bytes`,
      );
    }
  } finally {
    await fs.rm(stageRoot, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
