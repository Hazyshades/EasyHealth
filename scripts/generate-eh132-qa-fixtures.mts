import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_DIRECTORY = "QA/eh-132/fixtures";

function escapePdfText(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function buildTextPdf(lines: readonly string[], fontSize = 10): string {
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

function writePdf(filename: string, lines: readonly string[], fontSize = 10): void {
  writeFileSync(join(OUTPUT_DIRECTORY, filename), buildTextPdf(lines, fontSize), "ascii");
}

const disclaimer = "Fictional de-identified QA fixture; not a medical record or clinical advice.";

const timelineFixtures = [
  {
    id: "EH132-TIMELINE-01-LAB",
    filename: "EH132-TIMELINE-01-LAB-2026-08-13.pdf",
    documentType: "lab_result",
    purpose: "Laboratory event with an explicit collection date.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-01-LAB",
      "Document type: Laboratory result",
      "Collection date: 2026-08-13",
      "Laboratory: Example Diagnostics (fictional)",
      "Specimen: whole blood | Analyte: Hemoglobin (HGB) | Result: 150 | Unit: g/L | Reference: 130 - 170",
      "Specimen: whole blood | Analyte: White blood cells (WBC) | Result: 6.2 | Unit: x10^9/L | Reference: 4.0 - 10.0",
      "Source note: Medical date is the collection date; upload time is intentionally different.",
    ],
  },
  {
    id: "EH132-TIMELINE-01-INSTRUMENTAL",
    filename: "EH132-TIMELINE-01-INSTRUMENTAL-2026-07-22.pdf",
    documentType: "instrumental_report",
    purpose: "Instrumental report event with an explicit study date.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-01-INSTRUMENTAL",
      "Document type: Instrumental report",
      "Study date: 2026-07-22",
      "Facility: Synthetic Imaging Center",
      "Modality: MRI",
      "Body region: left knee",
      "Finding: Mild synthetic signal change; no acute finding in this fictional report.",
      "Impression: Fictional stable study for timeline ordering only.",
    ],
  },
  {
    id: "EH132-TIMELINE-01-CONSULTATION",
    filename: "EH132-TIMELINE-01-CONSULTATION-2026-06-16.pdf",
    documentType: "consultation_note",
    purpose: "Consultation event with an explicit visit date.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-01-CONSULTATION",
      "Document type: Consultation note",
      "Visit date: 2026-06-16",
      "Provider: Dr. Synthetic Reviewer",
      "Chief complaint: Fictional routine follow-up",
      "History summary: Synthetic history included only to exercise document extraction.",
      "Assessment: No clinical conclusion; this is a test fixture.",
      "Follow-up plan: Repeat synthetic review if needed.",
    ],
  },
  {
    id: "EH132-TIMELINE-01-DISCHARGE",
    filename: "EH132-TIMELINE-01-DISCHARGE-2026-05-08.pdf",
    documentType: "discharge_summary",
    purpose: "Discharge event with an admission/discharge date range.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-01-DISCHARGE",
      "Document type: Discharge summary",
      "Admission date: 2026-05-06",
      "Discharge date: 2026-05-08",
      "Provider: Synthetic Hospital",
      "Hospital course: Fictional stable course used for date-range projection.",
      "Discharge diagnoses: Synthetic diagnosis A; synthetic diagnosis B.",
      "Recommendations: Follow the synthetic follow-up plan.",
    ],
  },
  {
    id: "EH132-TIMELINE-01-PRESCRIPTION",
    filename: "EH132-TIMELINE-01-PRESCRIPTION-2026-04-19.pdf",
    documentType: "prescription",
    purpose: "Prescription event with an explicit prescribed date.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-01-PRESCRIPTION",
      "Document type: Prescription",
      "Prescribed date: 2026-04-19",
      "Prescriber: Synthetic Prescriber",
      "Medication: Fictional study medication | Dose: 1 tablet | Frequency: once daily | Duration: 7 days",
      "Instructions: This medication line is synthetic and must not be used clinically.",
    ],
  },
  {
    id: "EH132-TIMELINE-01-REFERRAL",
    filename: "EH132-TIMELINE-01-REFERRAL-2026-03-11.pdf",
    documentType: "referral",
    purpose: "Referral event with an explicit referral date.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-01-REFERRAL",
      "Document type: Referral",
      "Referral date: 2026-03-11",
      "Referring provider: Synthetic Primary Care",
      "Referred to specialty: Synthetic Cardiology",
      "Reason for referral: Fictional review of a synthetic result.",
      "Urgency: routine",
    ],
  },
  {
    id: "EH132-TIMELINE-02-UNKNOWN-DATE",
    filename: "EH132-TIMELINE-02-UNKNOWN-DATE.pdf",
    documentType: "consultation_note",
    purpose: "Supported document with no medical date; upload time must not become event date.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-TIMELINE-02-UNKNOWN-DATE",
      "Document type: Consultation note",
      "No medical date is stated in this document.",
      "No collection date, report date, visit date, admission date, discharge date, or referral date is available.",
      "Provider: Synthetic Reviewer",
      "Summary: This document intentionally contains no medical date.",
      "QA instruction: preserve unknown date; do not substitute upload time.",
    ],
  },
] as const;

const comparisonFixtures = [
  {
    id: "EH132-COMPARE-01-LAB-A",
    filename: "EH132-COMPARE-01-LAB-A-2026-08-13.pdf",
    documentType: "lab_result",
    purpose: "First compatible source for the reviewed Hemoglobin whole_blood definition.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-COMPARE-01-LAB-A",
      "Document type: Laboratory result",
      "Collection date: 2026-08-13",
      "Laboratory: Synthetic Lab A",
      "Specimen: whole blood | Analyte: Hemoglobin (HGB) | Result: 150 | Unit: g/L | Reference: 130 - 170",
      "Specimen: whole blood | Analyte: Hematocrit (HCT) | Result: 45.0 | Unit: % | Reference: 40 - 50",
      "Specimen: whole blood | Analyte: RDW-CV | Result: 12.5 | Unit: % | Reference: 11.5 - 14.5",
      "Specimen: whole blood | Analyte: RDW-SD | Result: 42 | Unit: fL | Reference: 37 - 54",
      "QA role: compatible comparison source A; retain native value, range, laboratory, and source document.",
    ],
  },
  {
    id: "EH132-COMPARE-01-LAB-B",
    filename: "EH132-COMPARE-01-LAB-B-2026-08-15.pdf",
    documentType: "lab_result",
    purpose: "Second compatible source for the reviewed Hemoglobin whole_blood definition in g/dL.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-COMPARE-01-LAB-B",
      "Document type: Laboratory result",
      "Collection date: 2026-08-15",
      "Laboratory: Synthetic Lab B",
      "Specimen: whole blood | Analyte: Hemoglobin (HGB) | Result: 14.2 | Unit: g/dL | Reference: 13.0 - 17.0",
      "Specimen: whole blood | Analyte: Hematocrit (HCT) | Result: 44.0 | Unit: % | Reference: 40 - 50",
      "Specimen: whole blood | Analyte: RDW-CV | Result: 13.1 | Unit: % | Reference: 11.5 - 14.5",
      "Specimen: whole blood | Analyte: RDW-SD | Result: 43 | Unit: fL | Reference: 37 - 54",
      "QA role: compatible comparison source B; accepted unit variant must remain linked to this source.",
    ],
  },
  {
    id: "EH132-COMPARE-02-CONTROLS",
    filename: "EH132-COMPARE-02-CONTROLS-2026-08-16.pdf",
    documentType: "lab_result",
    purpose: "Incompatible-series controls: RDW separation, specimen conflict, unresolved, and ineligible rows.",
    lines: [
      "EasyHealth Synthetic QA Fixture",
      disclaimer,
      "Fixture ID: EH132-COMPARE-02-CONTROLS",
      "Document type: Laboratory result",
      "Collection date: 2026-08-16",
      "Laboratory: Synthetic Control Lab",
      "Specimen: whole blood | Analyte: RDW-CV | Result: 12.8 | Unit: % | Reference: 11.5 - 14.5",
      "Specimen: whole blood | Analyte: RDW-SD | Result: 41 | Unit: fL | Reference: 37 - 54",
      "Specimen: serum | Analyte: Glucose | Result: 5.1 | Unit: mmol/L | Reference: 3.9 - 5.5",
      "Specimen: plasma | Analyte: Glucose | Result: 95 | Unit: mg/dL | Reference: 70 - 99",
      "Specimen: urine | Analyte: Glucose | Result: 0.2 | Unit: mmol/L | Reference: 0.0 - 0.8",
      "Analyte: Mystery marker | Result: 12 | Unit: unknown_unit | Reference: not provided | QA status: unresolved",
      "Analyte: Hemoglobin | Result: Positive | Unit: g/L | Reference: not provided | QA status: ineligible nonnumeric",
    ],
  },
] as const;

const timelineEventTypes = [
  "lab_result",
  "instrumental_report",
  "consultation_note",
  "discharge_summary",
  "prescription",
  "referral",
] as const;

function isoDateFromIndex(index: number): string {
  const date = new Date(Date.UTC(2024, 0, 1 + (index % 730)));
  return date.toISOString().slice(0, 10);
}

function buildPerformanceFixture() {
  const events = Array.from({ length: 2_000 }, (_, index) => {
    const eventNumber = index + 1;
    const documentType = timelineEventTypes[index % timelineEventTypes.length];
    const eventDate = isoDateFromIndex(index);
    return {
      id: `eh132-perf-${String(eventNumber).padStart(4, "0")}`,
      profileId: "<dedicated-synthetic-profile-id>",
      originalFilename: `EH132-PERF-01-${String(eventNumber).padStart(4, "0")}.pdf`,
      documentType,
      eventDate,
      createdAt: `${eventDate}T12:${String(index % 60).padStart(2, "0")}:00.000Z`,
      status: "completed",
      processingStatus: "completed",
      summary: "Synthetic EH132 performance event; not a medical record.",
    };
  });

  return {
    schemaVersion: 1,
    fixtureId: "EH132-PERF-01",
    disclaimer,
    profileId: "<dedicated-synthetic-profile-id>",
    eventCount: events.length,
    pageSize: 25,
    expectedPages: Math.ceil(events.length / 25),
    targetBudgetMs: 2_000,
    eventTypes: timelineEventTypes,
    events,
  };
}

mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
for (const fixture of [...timelineFixtures, ...comparisonFixtures]) {
  writePdf(fixture.filename, fixture.lines);
}
writeFileSync(
  join(OUTPUT_DIRECTORY, "EH132-PERF-01.json"),
  `${JSON.stringify(buildPerformanceFixture(), null, 2)}\n`,
  "utf8",
);

const manifest = {
  schemaVersion: 1,
  fixturePack: "EH132",
  disclaimer,
  syntheticOnly: true,
  timeline: {
    requiredTypes: timelineEventTypes,
    explicitDateFixtures: timelineFixtures.filter((fixture) => fixture.id.includes("TIMELINE-01")),
    unknownDateFixture: "EH132-TIMELINE-02-UNKNOWN-DATE.pdf",
  },
  comparison: {
    compatibleSources: [
      "EH132-COMPARE-01-LAB-A-2026-08-13.pdf",
      "EH132-COMPARE-01-LAB-B-2026-08-15.pdf",
    ],
    controls: "EH132-COMPARE-02-CONTROLS-2026-08-16.pdf",
    concreteDefinition: "Hemoglobin / whole_blood",
  },
  performance: {
    file: "EH132-PERF-01.json",
    eventCount: 2_000,
    pageSize: 25,
    targetBudgetMs: 2_000,
    profileIdPlaceholder: "<dedicated-synthetic-profile-id>",
  },
  uploadNotes: [
    "Use a dedicated test profile and synthetic documents only.",
    "For timeline fixtures, choose the manifest documentType in the upload form.",
    "Process normal-path documents before running the manual UI checks.",
    "The performance JSON is a deterministic seed definition; bind its profile placeholder only in an approved synthetic performance environment.",
  ],
};
writeFileSync(join(OUTPUT_DIRECTORY, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(`Generated ${timelineFixtures.length + comparisonFixtures.length} PDF fixtures and EH132-PERF-01.json in ${OUTPUT_DIRECTORY}`);
