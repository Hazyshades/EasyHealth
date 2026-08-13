import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function buildTextPdf(lines: readonly string[], fontSize: number): string {
  const commands = ["BT", `/F1 ${fontSize} Tf`, "72 740 Td"];
  for (const [index, line] of lines.entries()) {
    if (index > 0) commands.push("0 -14 Td");
    commands.push(`(${escapePdfText(line)}) Tj`);
  }
  commands.push("ET");

  const stream = `${commands.join("\n")}\n`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}endstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${offset.toString().padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

const fixtures = [
  {
    filename: "eh124_synthetic_report_with_a_deliberately_long_filename_for_review_workspace_accessibility.pdf",
    fontSize: 3.5,
    lines: [
      "EasyHealth synthetic long-evidence laboratory report - not a medical record",
      "Report date: 2026-08-12",
      "Test | Result | Unit | Reference range",
      "Ultra-long synthetic analyte name for accessibility and wrapping verification including source provenance details | 1234567890123456789012345678901234567890 | units-per-litre | 0 - 999999999999999999999",
      "Source note: This deliberately long synthetic explanatory sentence verifies that review rows preserve readable evidence and reachable controls at narrow widths.",
    ],
  },
  {
    filename: "eh124_missing_range_incomplete_identity_mock.pdf",
    fontSize: 10,
    lines: [
      "EasyHealth synthetic missing-range laboratory report - not a medical record",
      "Report date: 2026-08-12",
      "Test | Result | Unit | Reference range",
      "ALT (alanine aminotransferase) | 32 | U/L |",
      "Glucose | 5.1 | mmol/L |",
      "Specimen and collection method are not stated in this report.",
    ],
  },
] as const;

const outputDirectory = "lab_data";
for (const fixture of fixtures) {
  const outputPath = join(outputDirectory, fixture.filename);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buildTextPdf(fixture.lines, fixture.fontSize), "ascii");
  console.log(outputPath);
}
