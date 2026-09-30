import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
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
import type { ReportSectionId, ReportSource } from "@/lib/report-contract";
import type { ExportProjection } from "./projection";

type PdfRenderer = {
  Document: typeof PdfDocument;
  Font: typeof PdfFont;
  Page: typeof PdfPage;
  StyleSheet: typeof PdfStyleSheet;
  Text: typeof PdfText;
  View: typeof PdfView;
  renderToBuffer: typeof pdfRenderToBuffer;
};

const FONT_FAMILY = "EasyHealthDejaVuSans";
const FONT_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "report-export",
  "assets",
  "DejaVuSans.ttf",
);
const MAX_PDF_INPUT_BYTES = 1_000_000;

const PDF_FONT_SUBSET_SUFFIX = Buffer.from("+DejaVuSans", "ascii");
const PDF_FONT_SUBSET_TAG = "EH153A";

function normalizePdfFontSubsetTags(bytes: Uint8Array): Uint8Array {
  const normalized = Buffer.from(bytes);
  let offset = 0;
  while (true) {
    const suffixIndex = normalized.indexOf(PDF_FONT_SUBSET_SUFFIX, offset);
    if (suffixIndex < 6) break;
    const tagStart = suffixIndex - 6;
    const tag = normalized.subarray(tagStart, suffixIndex);
    if (tag.every((byte) => byte >= 65 && byte <= 90)) {
      normalized.write(PDF_FONT_SUBSET_TAG, tagStart, 6, "ascii");
    }
    offset = suffixIndex + PDF_FONT_SUBSET_SUFFIX.length;
  }
  return new Uint8Array(normalized);
}

let fontRegistration: Promise<void> | null = null;

const PDF_STYLE_DEFINITION = {
  page: {
    paddingTop: 34,
    paddingBottom: 38,
    paddingHorizontal: 36,
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    lineHeight: 1.45,
    color: "#0f172a",
  },
  title: {
    fontSize: 20,
    lineHeight: 1.15,
    marginBottom: 5,
  },
  metadata: {
    color: "#475569",
    fontSize: 8,
    marginBottom: 16,
  },
  overview: {
    marginBottom: 14,
    padding: 10,
    borderRadius: 6,
    backgroundColor: "#f8fafc",
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 1.2,
    marginBottom: 6,
    color: "#0f766e",
  },
  item: {
    marginBottom: 5,
  },
  muted: {
    color: "#475569",
  },
  limited: {
    color: "#92400e",
  },
  citation: {
    color: "#475569",
    fontSize: 8,
    marginTop: 2,
  },
  source: {
    marginBottom: 5,
  },
  dynamics: {
    marginTop: 4,
    paddingTop: 10,
    borderTop: "1pt solid #cbd5e1",
  },
  series: {
    marginBottom: 8,
  },
  disclaimer: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: "1pt solid #cbd5e1",
    fontSize: 8,
    color: "#92400e",
  },
  versions: {
    marginTop: 8,
    fontSize: 8,
    color: "#475569",
  },
} as const;

const SECTION_TITLES: Record<ReportSectionId, string> = {
  document_summary: "Document summary",
  latest_measurements: "Latest measurements",
  changes: "Changes over time",
  clinician_questions: "Questions for your clinician",
  limitations: "Limitations",
  source_ledger: "Source ledger",
};

function emptyStateLabel(value: string | undefined): string {
  if (value === "not_applicable") return "Not applicable for this report.";
  if (value === "insufficient_evidence") {
    return "Insufficient source evidence for this section.";
  }
  return "No source-backed entries were available for this section.";
}
function toleranceLabel(
  label: string,
  tolerance: { absolute: number; relative: number } | null,
): string {
  return tolerance
    ? `; ${label} absolute ${tolerance.absolute}, relative ${tolerance.relative}`
    : "";
}

function snapshotValue(value: string | number | null): string {
  return value === null || value === "" ? "not recorded" : String(value);
}

function sourceLabel(source: ReportSource): string {
  const snapshot = source.snapshot;
  const header = `${source.source_id} · ${snapshot.label} [${snapshot.kind}]`;
  const observed = `observed ${snapshotValue(snapshot.observed_at)}`;
  switch (snapshot.kind) {
    case "observation":
      return [
        `${header}: ${snapshot.value_text ?? snapshotValue(snapshot.value)}`,
        `native ${snapshotValue(snapshot.value)}`,
        `unit ${snapshotValue(snapshot.unit)}`,
        `reference ${snapshotValue(snapshot.ref_low)}–${snapshotValue(snapshot.ref_high)}`,
        observed,
      ].join(" · ");
    case "finding":
      return [
        `${header}: finding ${snapshot.finding_text}`,
        `impression ${snapshotValue(snapshot.impression)}`,
        observed,
      ].join(" · ");
    case "clinical_note":
      return [
        `${header}: provider ${snapshotValue(snapshot.provider_name)}`,
        `summary ${snapshotValue(snapshot.summary)}`,
        observed,
      ].join(" · ");
    case "prescription":
      return [
        `${header}: prescriber ${snapshotValue(snapshot.prescriber_name)}`,
        `summary ${snapshotValue(snapshot.summary)}`,
        observed,
      ].join(" · ");
    case "referral":
      return [
        `${header}: referring provider ${snapshotValue(snapshot.referring_provider)}`,
        `specialty ${snapshotValue(snapshot.referred_to_specialty)}`,
        `summary ${snapshotValue(snapshot.summary)}`,
        observed,
      ].join(" · ");
    case "document_summary":
      return [
        `${header}: type ${snapshot.document_type}`,
        `summary ${snapshot.summary}`,
        observed,
      ].join(" · ");
  }
}

function citationText(
  claim: ExportProjection["report"]["claims"][number],
  sourceById: ReadonlyMap<string, ReportSource>,
): string {
  const labels = claim.citations.flatMap((citation) => {
    const source = sourceById.get(citation.source_id);
    return source ? [sourceLabel(source)] : [];
  });
  return labels.length > 0 ? `Sources: ${labels.join("; ")}` : "";
}

async function registerFont(renderer: PdfRenderer): Promise<void> {
  if (!fontRegistration) {
    fontRegistration = (async () => {
      const stat = await fs.stat(FONT_PATH);
      if (!stat.isFile() || stat.size === 0) {
        throw new Error("PDF_FONT_MISSING");
      }
      renderer.Font.register({ family: FONT_FAMILY, src: FONT_PATH });
    })();
  }
  await fontRegistration;
}

function renderSectionItem(
  item: ExportProjection["report"]["sections"][number]["items"][number],
  sectionId: ReportSectionId,
  claimById: ReadonlyMap<string, ExportProjection["report"]["claims"][number]>,
  limitationById: ReadonlyMap<
    string,
    ExportProjection["report"]["limitations"][number]
  >,
  sourceById: ReadonlyMap<string, ReportSource>,
  styles: PdfStyles,
  renderer: PdfRenderer,
  index: number,
): React.ReactElement | null {
  const { Text, View } = renderer;
  if (item.type === "claim_ref") {
    const claim = claimById.get(item.claim_id);
    if (!claim) return null;
    const text =
      claim.kind === "clinician_question" ? claim.question_text : claim.text;
    const citation = citationText(claim, sourceById);
    return (
      <View key={`${sectionId}-${item.claim_id}-${index}`} style={styles.item}>
        <Text style={claim.status === "limited" ? styles.limited : undefined}>
          {text}
          {claim.status === "limited" ? " (Limited evidence)" : ""}
        </Text>
        {citation ? <Text style={styles.citation}>{citation}</Text> : null}
      </View>
    );
  }
  if (item.type === "limitation_ref") {
    const limitation = limitationById.get(item.limitation_id);
    return limitation ? (
      <Text
        key={`${sectionId}-${item.limitation_id}-${index}`}
        style={styles.item}
      >
        {limitation.message}
      </Text>
    ) : null;
  }
  const source = sourceById.get(item.source_id);
  return source ? (
    <Text key={`${sectionId}-${item.source_id}-${index}`} style={styles.source}>
      {sourceLabel(source)} ({source.document_id})
    </Text>
  ) : null;
}

function ReportPdfDocument({
  projection,
  renderer,
}: {
  projection: ExportProjection;
  renderer: PdfRenderer;
}) {
  const { Document, Page, Text, View } = renderer;
  const styles = renderer.StyleSheet.create(PDF_STYLE_DEFINITION);
  const report = projection.report;
  const claimById = new Map(report.claims.map((claim) => [claim.id, claim]));
  const limitationById = new Map(
    report.limitations.map((limitation) => [limitation.id, limitation]),
  );
  const sourceById = new Map(
    report.sourceLedger.map((source) => [source.source_id, source]),
  );

  const creationDate = new Date(report.generatedAt);
  if (Number.isNaN(creationDate.getTime())) {
    throw new Error("PDF_GENERATED_AT_INVALID");
  }
  return (
    <Document
      title={report.title}
      author="EasyHealth"
      creationDate={creationDate}
    >
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.metadata}>
          Generated {report.generatedAt} · Contract {report.schemaVersion} ·
          Validator {report.validation.version} · Validation{" "}
          {report.validation.status}
        </Text>
        <View style={styles.overview}>
          <Text>{report.overview}</Text>
        </View>
        {report.sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>
              {SECTION_TITLES[section.id]}
            </Text>
            {section.items.length === 0 ? (
              <Text style={styles.muted}>
                {emptyStateLabel(section.empty_state)}
              </Text>
            ) : (
              section.items.map((item, index) =>
                renderSectionItem(
                  item,
                  section.id,
                  claimById,
                  limitationById,
                  sourceById,
                  styles,
                  renderer,
                  index,
                ),
              )
            )}
          </View>
        ))}
        {projection.dynamics ? (
          <View style={styles.dynamics}>
            <Text style={styles.sectionTitle}>Biomarker dynamics</Text>
            {projection.dynamics.series.length === 0 ? (
              <Text style={styles.muted}>
                No dynamics series were available.
              </Text>
            ) : (
              projection.dynamics.series.map((series) => (
                <View key={series.id} style={styles.series}>
                  <Text>
                    {series.label}: {series.direction.value};{" "}
                    {series.statistics.pointCount} point
                    {series.statistics.pointCount === 1 ? "" : "s"}
                    {toleranceLabel(
                      "direction tolerance",
                      series.direction.tolerance,
                    )}
                    {toleranceLabel("series tolerance", series.tolerance)}
                  </Text>
                  {series.points.map((point) => (
                    <Text key={point.id} style={styles.muted}>
                      {point.observedAt} ·{" "}
                      {point.displayValue ?? "value unavailable"}
                      {point.displayUnit ? ` ${point.displayUnit}` : ""} ·
                      source {point.id} · document {point.documentId}
                      {point.source
                        ? ` · ${point.source.filename}${point.source.laboratory ? ` · ${point.source.laboratory}` : ""}`
                        : ""}
                    </Text>
                  ))}
                </View>
              ))
            )}
            <Text style={styles.citation}>
              {projection.dynamics.disclaimer}
            </Text>
          </View>
        ) : null}
        <Text style={styles.disclaimer}>{report.disclaimer}</Text>
        <Text style={styles.versions}>
          Export eh153.v1 · Contract {report.schemaVersion} · Validator{" "}
          {report.validation.version}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderPdfProjection(
  projection: ExportProjection,
): Promise<Uint8Array> {
  const inputSize = new TextEncoder().encode(
    JSON.stringify(projection),
  ).byteLength;
  if (inputSize > MAX_PDF_INPUT_BYTES) {
    throw new Error("PDF_REPORT_TOO_LARGE");
  }
  try {
    // Native ESM loading avoids CJS resolution of @react-pdf/hyphenate language subpaths.
    const renderer = await import("@react-pdf/renderer");
    await registerFont(renderer);
    const buffer = await renderer.renderToBuffer(
      <ReportPdfDocument projection={projection} renderer={renderer} />,
    );
    const bytes = normalizePdfFontSubsetTags(buffer);
    if (
      bytes.byteLength < 5 ||
      String.fromCharCode(...bytes.slice(0, 5)) !== "%PDF-"
    ) {
      throw new Error("PDF_OUTPUT_INVALID");
    }
    return bytes;
  } catch (error) {
    fontRegistration = null;
    throw error instanceof Error && error.message === "PDF_REPORT_TOO_LARGE"
      ? error
      : new Error("PDF_RENDER_FAILED");
  }
}
