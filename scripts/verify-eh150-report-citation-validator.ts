import assert from "node:assert/strict";
import { MEDICAL_DISCLAIMER } from "../src/lib/schemas/biomarkers";
import {
  CURRENT_REPORT_SCHEMA_VERSION,
  CURRENT_VALIDATOR_VERSION,
  RECOGNIZED_VALIDATOR_VERSIONS,
  isPublishableValidationEnvelope,
  isRecognizedValidatorVersion,
  validatePersistedValidationEnvelope,
  validateReportContent,
  type AuthorizedReportSource,
  type ReportCitationValidationContext,
  type ReportClaim,
  type ReportContent,
  type ReportSectionReference,
} from "../src/lib/report-citation-validator";

const PROFILE_A = "profile-a";
const PROFILE_B = "profile-b";
const DOCUMENT_A = "document-a";
const DOCUMENT_B = "document-b";
const SOURCE_FACT = "source-fact";
const SOURCE_OBSERVATION = "source-observation";

const SOURCE_ROWS: AuthorizedReportSource[] = [
  {
    source_id: SOURCE_FACT,
    source_row_id: "finding-a",
    kind: "finding",
    document_id: DOCUMENT_A,
    profile_id: PROFILE_A,
    availability: "available",
    document_state: "active",
    snapshot: { text: "Authorized finding" },
  },
  {
    source_id: SOURCE_OBSERVATION,
    source_row_id: "observation-a",
    kind: "observation",
    document_id: DOCUMENT_A,
    profile_id: PROFILE_A,
    availability: "available",
    document_state: "active",
    snapshot: { value: 5.4, unit: "%", reference_range: "4.0-5.6" },
  },
];

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sourceRef(sourceId: string) {
  return { type: "source_ref", source_id: sourceId } as const;
}

function claimRef(claimId: string) {
  return { type: "claim_ref", claim_id: claimId } as const;
}

function baseContent(
  options: { includeChange?: boolean } = {},
): Omit<ReportContent, "overview"> {
  const includeChange = options.includeChange ?? true;
  const claims: ReportContent["claims"] = [
    {
      id: "summary-claim",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      citations: [{ source_id: SOURCE_FACT, document_id: DOCUMENT_A }],
      factual: true,
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: SOURCE_FACT, include_date: true },
    },
    {
      id: "summary-claim-2",
      section: "document_summary",
      kind: "source_fact",
      origin: "generated",
      citations: [{ source_id: SOURCE_FACT, document_id: DOCUMENT_A }],
      factual: true,
      status: "supported",
      template_id: "source_fact_snapshot",
      template_params: { source_id: SOURCE_FACT, include_date: false },
    } as ReportContent["claims"][number],
    {
      id: "measurement-claim",
      section: "latest_measurements",
      kind: "numeric_observation",
      origin: "generated",
      citations: [{ source_id: SOURCE_OBSERVATION, document_id: DOCUMENT_A }],
      factual: true,
      status: "supported",
      template_id: "numeric_observation_snapshot",
      template_params: { source_id: SOURCE_OBSERVATION, include_range: true },
    },
    {
      id: "measurement-claim-2",
      section: "latest_measurements",
      kind: "numeric_observation",
      origin: "generated",
      citations: [{ source_id: SOURCE_OBSERVATION, document_id: DOCUMENT_A }],
      factual: true,
      status: "supported",
      template_id: "numeric_observation_snapshot",
      template_params: { source_id: SOURCE_OBSERVATION, include_range: false },
    } as ReportContent["claims"][number],
    ...(includeChange
      ? [
          {
            id: "change-claim",
            section: "changes",
            kind: "numeric_observation",
            origin: "generated",
            citations: [
              { source_id: SOURCE_OBSERVATION, document_id: DOCUMENT_A },
            ],
            factual: true,
            status: "supported",
            template_id: "numeric_observation_snapshot",
            template_params: {
              source_id: SOURCE_OBSERVATION,
              include_range: true,
            },
          } as ReportContent["claims"][number],
        ]
      : []),
    {
      id: "question-claim",
      section: "clinician_questions",
      kind: "clinician_question",
      origin: "user_selected",
      citations: [],
      factual: false,
      status: "supported",
      question_text:
        "Which follow-up measurements should I discuss with my clinician?",
    } as ReportContent["claims"][number],
  ];
  const sections: ReportContent["sections"] = [
    {
      id: "document_summary",
      items: [claimRef("summary-claim"), claimRef("summary-claim-2")],
    },
    {
      id: "latest_measurements",
      items: [claimRef("measurement-claim"), claimRef("measurement-claim-2")],
    },
    includeChange
      ? { id: "changes", items: [claimRef("change-claim")] }
      : { id: "changes", items: [], empty_state: "no_data" },
    { id: "clinician_questions", items: [claimRef("question-claim")] },
    { id: "limitations", items: [], empty_state: "no_data" },
    {
      id: "source_ledger",
      items: [sourceRef(SOURCE_FACT), sourceRef(SOURCE_OBSERVATION)],
    },
  ];
  return {
    schema_version: CURRENT_REPORT_SCHEMA_VERSION,
    report_kind: "doctor_visit_brief",
    generated_at: "2026-09-22T12:00:00.000Z",
    detail_level: "standard",
    source_document_ids: [DOCUMENT_A],
    sections,
    claims,
    sources: [
      {
        source_id: SOURCE_FACT,
        kind: "finding",
        document_id: DOCUMENT_A,
        snapshot: { text: "Synthetic finding" },
      },
      {
        source_id: SOURCE_OBSERVATION,
        kind: "observation",
        document_id: DOCUMENT_A,
        snapshot: { value: 5.4, unit: "%", reference_range: "4.0-5.6" },
      },
    ],
    limitations: [],
    disclaimer: MEDICAL_DISCLAIMER,
  };
}

function contextFor(
  rows: readonly AuthorizedReportSource[] = SOURCE_ROWS,
  calls: string[][] = [],
): ReportCitationValidationContext {
  return {
    profileId: PROFILE_A,
    documentScope: [DOCUMENT_A],
    resolveSources: (sourceIds) => {
      calls.push([...sourceIds]);
      return rows.filter((row) => sourceIds.includes(row.source_id));
    },
    renderOverview: () => "Synthetic server-rendered overview.",
  };
}

async function main() {
  const validCalls: string[][] = [];
  const valid = await validateReportContent(
    baseContent(),
    contextFor(SOURCE_ROWS, validCalls),
  );
  assert.equal(valid.status, "valid", JSON.stringify(valid));
  assert.equal(valid.issue_codes.length, 0);
  assert.ok(valid.content);
  assert.equal(valid.content.validation?.version, CURRENT_VALIDATOR_VERSION);
  const validQuestion = valid.content.claims.find(
    (claim) => claim.id === "question-claim",
  );
  assert.equal(validQuestion?.kind, "clinician_question");
  assert.equal(validQuestion?.factual, false);
  assert.deepEqual(validQuestion?.citations, []);
  assert.equal(valid.content.overview, "Synthetic server-rendered overview.");
  const validFactSource = valid.content.sources.find(
    (source) => source.source_id === SOURCE_FACT,
  );
  assert.deepEqual(validFactSource?.snapshot, SOURCE_ROWS[0].snapshot);
  assert.deepEqual(validCalls, [[SOURCE_FACT, SOURCE_OBSERVATION]]);

  const unicodeQuestionContent = clone(baseContent());
  const unicodeQuestion = unicodeQuestionContent.claims.find(
    (claim) => claim.id === "question-claim",
  );
  assert.ok(unicodeQuestion);
  unicodeQuestion.question_text = `${"😀".repeat(121)} e\u0301`;
  const unicodeQuestionResult = await validateReportContent(
    unicodeQuestionContent,
    contextFor(),
  );
  assert.equal(unicodeQuestionResult.status, "valid");
  assert.equal(
    unicodeQuestionResult.content?.claims.find(
      (claim) => claim.id === "question-claim",
    )?.question_text,
    `${"😀".repeat(121)} é`,
  );

  for (const separator of [
    "\u2028",
    "\u2029",
    "\u0085",
    "\u202E",
    "\u2066",
    "\uD800",
  ]) {
    const lineSeparatorContent = clone(baseContent());
    const lineSeparatorQuestion = lineSeparatorContent.claims.find(
      (claim) => claim.id === "question-claim",
    );
    assert.ok(lineSeparatorQuestion);
    lineSeparatorQuestion.question_text = `${separator}Synthetic question`;
    const lineSeparatorResult = await validateReportContent(
      lineSeparatorContent,
      contextFor(),
    );
    assert.equal(lineSeparatorResult.status, "invalid");
    assert.deepEqual(lineSeparatorResult.issue_codes, ["SCHEMA_INVALID"]);
  }

  const tooManyQuestions = clone(baseContent());
  const tooManyQuestionsSection = tooManyQuestions.sections.find(
    (section) => section.id === "clinician_questions",
  );
  assert.ok(tooManyQuestionsSection);
  const tooManyQuestionClaims =
    tooManyQuestions.claims as unknown as ReportClaim[];
  const tooManyQuestionItems =
    tooManyQuestionsSection.items as unknown as ReportSectionReference[];
  for (let index = 2; index <= 6; index += 1) {
    const id = `question-${index}`;
    tooManyQuestionClaims.push({
      id,
      section: "clinician_questions",
      kind: "clinician_question",
      origin: "user_selected",
      citations: [],
      factual: false,
      status: "supported",
      question_text: `Synthetic question ${index}?`,
    } as ReportContent["claims"][number]);
    tooManyQuestionItems.push({ type: "claim_ref", claim_id: id });
  }
  const tooManyQuestionsResult = await validateReportContent(
    tooManyQuestions,
    contextFor(),
  );
  assert.equal(tooManyQuestionsResult.status, "invalid");
  assert.deepEqual(tooManyQuestionsResult.issue_codes, ["SCHEMA_INVALID"]);

  const duplicateQuestions = clone(baseContent());
  const duplicateQuestionsSection = duplicateQuestions.sections.find(
    (section) => section.id === "clinician_questions",
  );
  assert.ok(duplicateQuestionsSection);
  const duplicateQuestionClaims =
    duplicateQuestions.claims as unknown as ReportClaim[];
  const duplicateQuestionItems =
    duplicateQuestionsSection.items as unknown as ReportSectionReference[];
  duplicateQuestionClaims.push({
    id: "question-duplicate",
    section: "clinician_questions",
    kind: "clinician_question",
    origin: "user_selected",
    citations: [],
    factual: false,
    status: "supported",
    question_text:
      "  Which follow-up measurements should I discuss with my clinician?  ",
  } as ReportContent["claims"][number]);
  duplicateQuestionItems.push({
    type: "claim_ref",
    claim_id: "question-duplicate",
  });
  const duplicateQuestionsResult = await validateReportContent(
    duplicateQuestions,
    contextFor(),
  );
  assert.equal(duplicateQuestionsResult.status, "invalid");
  assert.deepEqual(duplicateQuestionsResult.issue_codes, ["SCHEMA_INVALID"]);

  const limitedWithoutVisibleLimitation = clone(baseContent());
  const limitedClaim = limitedWithoutVisibleLimitation.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(limitedClaim);
  limitedClaim.status = "limited";
  const limitedWithoutVisibleLimitationResult = await validateReportContent(
    limitedWithoutVisibleLimitation,
    contextFor(),
  );
  assert.equal(limitedWithoutVisibleLimitationResult.status, "invalid");
  assert.ok(
    limitedWithoutVisibleLimitationResult.issue_codes.includes(
      "SCHEMA_INVALID",
    ),
  );
  assert.equal(limitedWithoutVisibleLimitationResult.content, null);

  const limitedWithUnrelatedLimitation = clone(baseContent());
  const unrelatedLimitedClaim = limitedWithUnrelatedLimitation.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(unrelatedLimitedClaim);
  unrelatedLimitedClaim.status = "limited";
  const unrelatedLimitations =
    limitedWithUnrelatedLimitation.limitations as unknown as Array<
      ReportContent["limitations"][number]
    >;
  const unrelatedLimitationSection =
    limitedWithUnrelatedLimitation.sections.find(
      (section) => section.id === "limitations",
    );
  assert.ok(unrelatedLimitationSection);
  delete unrelatedLimitationSection.empty_state;
  unrelatedLimitations.push({
    id: "candidate-no-data",
    code: "NO_DATA",
    message: "Synthetic unrelated limitation",
  });
  const unrelatedLimitationItems =
    unrelatedLimitationSection.items as unknown as ReportSectionReference[];
  unrelatedLimitationItems.push({
    type: "limitation_ref",
    limitation_id: "candidate-no-data",
  });
  const limitedWithUnrelatedLimitationResult = await validateReportContent(
    limitedWithUnrelatedLimitation,
    contextFor(),
  );
  assert.equal(limitedWithUnrelatedLimitationResult.status, "invalid");
  assert.deepEqual(limitedWithUnrelatedLimitationResult.issue_codes, [
    "SCHEMA_INVALID",
  ]);

  const uncited = clone(baseContent());
  const uncitedClaim = uncited.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(uncitedClaim);
  uncitedClaim.citations = [];
  uncitedClaim.template_params = { source_id: SOURCE_FACT, include_date: true };
  const uncitedResult = await validateReportContent(uncited, contextFor());
  assert.equal(uncitedResult.status, "limited");
  assert.ok(uncitedResult.issue_codes.includes("CLAIM_UNCITED"));
  assert.ok(uncitedResult.content);
  assert.equal(
    uncitedResult.content.claims.some((claim) => claim.id === "summary-claim"),
    false,
  );
  assert.ok(
    uncitedResult.content.limitations.some(
      (limitation) => limitation.code === "CLAIM_UNCITED",
    ),
  );
  const lastClaimSanitized = clone(baseContent());
  for (const claim of lastClaimSanitized.claims.filter(
    (candidate) => candidate.section === "document_summary",
  )) {
    claim.citations = [];
  }
  const lastClaimSanitizedResult = await validateReportContent(
    lastClaimSanitized,
    contextFor(),
  );
  assert.equal(lastClaimSanitizedResult.status, "invalid");
  assert.ok(lastClaimSanitizedResult.issue_codes.includes("SCHEMA_INVALID"));
  assert.equal(lastClaimSanitizedResult.content, null);

  const lastClaimRemoved = clone(baseContent());
  for (const claim of lastClaimRemoved.claims.filter(
    (candidate) => candidate.section === "document_summary",
  )) {
    claim.status = "removed";
  }
  const lastClaimRemovedResult = await validateReportContent(
    lastClaimRemoved,
    contextFor(),
  );
  assert.equal(lastClaimRemovedResult.status, "invalid");
  assert.ok(lastClaimRemovedResult.issue_codes.includes("SCHEMA_INVALID"));
  assert.equal(lastClaimRemovedResult.content, null);

  const unreferencedLastClaimRemoved = clone(baseContent());
  for (const claim of unreferencedLastClaimRemoved.claims.filter(
    (candidate) => candidate.section === "document_summary",
  )) {
    claim.status = "removed";
  }
  const unreferencedSummary = unreferencedLastClaimRemoved.sections.find(
    (section) => section.id === "document_summary",
  );
  assert.ok(unreferencedSummary);
  unreferencedSummary.items = [];
  unreferencedSummary.empty_state = "no_data";
  const unreferencedLastClaimRemovedResult = await validateReportContent(
    unreferencedLastClaimRemoved,
    contextFor(),
  );
  assert.equal(unreferencedLastClaimRemovedResult.status, "invalid");
  assert.ok(
    unreferencedLastClaimRemovedResult.issue_codes.includes("SCHEMA_INVALID"),
  );
  assert.equal(unreferencedLastClaimRemovedResult.content, null);

  const unsafe = clone(baseContent());
  const unsafeClaim = unsafe.claims.find(
    (claim) => claim.id === "measurement-claim",
  );
  assert.ok(unsafeClaim);
  const unsafeFields = {
    text: "Synthetic free-form factual prose must not survive",
    diagnosis: "Synthetic diagnosis must not survive",
    treatment: "Synthetic treatment direction must not survive",
    urgency: "Synthetic urgency directive must not survive",
    imperative: "Synthetic imperative must not survive",
    recommendation: "Synthetic recommendation must not survive",
    prescription: "Synthetic prescription must not survive",
  };
  Object.assign(unsafeClaim as Record<string, unknown>, unsafeFields);
  const unsafeResult = await validateReportContent(unsafe, contextFor());
  assert.equal(unsafeResult.status, "limited");
  assert.ok(unsafeResult.issue_codes.includes("UNSAFE_CONTENT"));
  assert.ok(unsafeResult.content);
  for (const marker of Object.values(unsafeFields)) {
    assert.equal(JSON.stringify(unsafeResult.content).includes(marker), false);
  }
  assert.equal(
    unsafeResult.content.claims.some(
      (claim) => claim.id === "measurement-claim",
    ),
    false,
  );

  const crossProfileRows = clone(SOURCE_ROWS);
  crossProfileRows[0].profile_id = PROFILE_B;
  const crossProfileResult = await validateReportContent(
    baseContent(),
    contextFor(crossProfileRows),
  );
  assert.equal(crossProfileResult.status, "invalid");
  assert.deepEqual(crossProfileResult.issue_codes, ["PROFILE_MISMATCH"]);
  assert.equal(JSON.stringify(crossProfileResult).includes(PROFILE_B), false);
  const missingProfileRows = clone(SOURCE_ROWS);
  delete (missingProfileRows[0] as unknown as Record<string, unknown>)
    .profile_id;
  const missingProfileResult = await validateReportContent(
    baseContent(),
    contextFor(missingProfileRows),
  );
  assert.equal(missingProfileResult.status, "invalid");
  assert.ok(missingProfileResult.issue_codes.includes("SOURCE_NOT_FOUND"));

  const missingSourceRowRows = clone(SOURCE_ROWS);
  delete (missingSourceRowRows[0] as unknown as Record<string, unknown>)
    .source_row_id;
  const missingSourceRowResult = await validateReportContent(
    baseContent(),
    contextFor(missingSourceRowRows),
  );
  assert.equal(missingSourceRowResult.status, "invalid");
  assert.ok(missingSourceRowResult.issue_codes.includes("SOURCE_NOT_FOUND"));

  const outOfScope = clone(baseContent());
  const outOfScopeSource = outOfScope.sources.find(
    (source) => source.source_id === SOURCE_FACT,
  );
  assert.ok(outOfScopeSource);
  outOfScopeSource.document_id = DOCUMENT_B;
  const outOfScopeRows = clone(SOURCE_ROWS);
  outOfScopeRows[0].document_id = DOCUMENT_B;
  const outOfScopeResult = await validateReportContent(
    outOfScope,
    contextFor(outOfScopeRows),
  );
  assert.equal(outOfScopeResult.status, "invalid");
  assert.ok(outOfScopeResult.issue_codes.includes("DOCUMENT_OUT_OF_SCOPE"));

  const unknownCitation = clone(baseContent());
  const unknownClaim = unknownCitation.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(unknownClaim);
  unknownClaim.citations = [
    { source_id: "missing-source", document_id: DOCUMENT_A },
  ];
  unknownClaim.template_params = {
    source_id: "missing-source",
    include_date: true,
  };
  const unknownResult = await validateReportContent(
    unknownCitation,
    contextFor(),
  );
  assert.equal(unknownResult.status, "invalid");
  assert.ok(unknownResult.issue_codes.includes("SOURCE_NOT_FOUND"));

  const wrongSourceKind = clone(baseContent());
  const wrongKindClaim = wrongSourceKind.claims.find(
    (claim) => claim.id === "measurement-claim",
  );
  assert.ok(wrongKindClaim);
  wrongKindClaim.citations = [
    { source_id: SOURCE_FACT, document_id: DOCUMENT_A },
  ];
  wrongKindClaim.template_params = {
    source_id: SOURCE_FACT,
    include_range: true,
  };
  const wrongKindResult = await validateReportContent(
    wrongSourceKind,
    contextFor(),
  );
  assert.equal(wrongKindResult.status, "invalid");
  assert.ok(wrongKindResult.issue_codes.includes("SOURCE_KIND_NOT_ALLOWED"));

  const missingSection = clone(baseContent());
  missingSection.sections = missingSection.sections.slice(0, 5);
  const missingSectionResult = await validateReportContent(
    missingSection,
    contextFor(),
  );
  assert.equal(missingSectionResult.status, "invalid");
  assert.deepEqual(missingSectionResult.issue_codes, ["SCHEMA_INVALID"]);
  const unknownSchema = clone(baseContent());
  unknownSchema.schema_version = "eh148.v999";
  const unknownSchemaResult = await validateReportContent(
    unknownSchema,
    contextFor(),
  );
  assert.equal(unknownSchemaResult.status, "invalid");
  assert.deepEqual(unknownSchemaResult.issue_codes, ["SCHEMA_INVALID"]);

  const overviewInjection = {
    ...baseContent(),
    overview: "Synthetic unsupported diagnosis must not survive",
  };
  const overviewInjectionResult = await validateReportContent(
    overviewInjection,
    contextFor(),
  );
  assert.equal(overviewInjectionResult.status, "invalid");
  assert.deepEqual(overviewInjectionResult.issue_codes, ["SCHEMA_INVALID"]);

  const extensionInjection = {
    ...baseContent(),
    extensions: {
      biomarker_dynamics: { fabricated: true },
    },
  };
  const extensionInjectionResult = await validateReportContent(
    extensionInjection,
    contextFor(),
  );
  assert.equal(extensionInjectionResult.status, "invalid");
  assert.deepEqual(extensionInjectionResult.issue_codes, ["SCHEMA_INVALID"]);

  for (const unsafeOverview of [
    "\u000bSynthetic overview",
    "Synthetic overview\u2028",
    "Synthetic\u0085overview",
    "Synthetic\u2028overview",
    "Synthetic\u202Eoverview",
    "Synthetic\u2066overview",
    "Synthetic\uD800overview",
  ]) {
    const unsafeOverviewResult = await validateReportContent(baseContent(), {
      ...contextFor(),
      renderOverview: () => unsafeOverview,
    });
    assert.equal(unsafeOverviewResult.status, "invalid");
    assert.deepEqual(unsafeOverviewResult.issue_codes, ["SCHEMA_INVALID"]);
  }

  const unknownTopLevelField = {
    ...baseContent(),
    extension_v2: { fabricated: true },
  };
  const unknownTopLevelFieldResult = await validateReportContent(
    unknownTopLevelField,
    contextFor(),
  );
  assert.equal(unknownTopLevelFieldResult.status, "invalid");
  assert.deepEqual(unknownTopLevelFieldResult.issue_codes, ["SCHEMA_INVALID"]);

  const factualQuestionText = clone(baseContent());
  const factualClaimWithQuestion = factualQuestionText.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(factualClaimWithQuestion);
  (factualClaimWithQuestion as Record<string, unknown>).question_text =
    "Synthetic question text on a factual claim";
  const factualQuestionTextResult = await validateReportContent(
    factualQuestionText,
    contextFor(),
  );
  assert.equal(factualQuestionTextResult.status, "invalid");
  assert.deepEqual(factualQuestionTextResult.issue_codes, ["SCHEMA_INVALID"]);

  const duplicateSection = clone(baseContent());
  duplicateSection.sections = duplicateSection.sections.map((section, index) =>
    index === 1 ? { ...section, id: "document_summary" } : section,
  );
  const duplicateSectionResult = await validateReportContent(
    duplicateSection,
    contextFor(),
  );
  assert.equal(duplicateSectionResult.status, "invalid");
  assert.deepEqual(duplicateSectionResult.issue_codes, ["SCHEMA_INVALID"]);

  const unknownSection = clone(baseContent());
  unknownSection.sections = unknownSection.sections.map((section, index) =>
    index === 0
      ? {
          ...section,
          id: "unknown_section" as ReportContent["sections"][number]["id"],
        }
      : section,
  );
  const unknownSectionResult = await validateReportContent(
    unknownSection,
    contextFor(),
  );
  assert.equal(unknownSectionResult.status, "invalid");
  assert.deepEqual(unknownSectionResult.issue_codes, ["SCHEMA_INVALID"]);
  const incompatibleClaim = clone(baseContent());
  const incompatible = incompatibleClaim.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(incompatible);
  incompatible.section = "clinician_questions";
  const incompatibleResult = await validateReportContent(
    incompatibleClaim,
    contextFor(),
  );
  assert.equal(incompatibleResult.status, "invalid");
  assert.ok(incompatibleResult.issue_codes.includes("SCHEMA_INVALID"));

  const kindSectionMismatch = clone(baseContent());
  const numericClaim = kindSectionMismatch.claims.find(
    (claim) => claim.id === "measurement-claim",
  );
  assert.ok(numericClaim);
  numericClaim.section = "document_summary";
  const kindSectionMismatchResult = await validateReportContent(
    kindSectionMismatch,
    contextFor(),
  );
  assert.equal(kindSectionMismatchResult.status, "invalid");
  assert.ok(kindSectionMismatchResult.issue_codes.includes("SCHEMA_INVALID"));

  const templateKindMismatch = clone(baseContent());
  const templateMismatchClaim = templateKindMismatch.claims.find(
    (claim) => claim.id === "measurement-claim",
  );
  assert.ok(templateMismatchClaim);
  templateMismatchClaim.template_id = "source_fact_snapshot";
  const templateKindMismatchResult = await validateReportContent(
    templateKindMismatch,
    contextFor(),
  );
  assert.equal(templateKindMismatchResult.status, "invalid");
  assert.ok(templateKindMismatchResult.issue_codes.includes("SCHEMA_INVALID"));
  const emptyResult = await validateReportContent(
    baseContent({ includeChange: false }),
    contextFor(),
  );
  assert.equal(emptyResult.status, "limited");
  assert.ok(emptyResult.content);
  const emptyChanges = emptyResult.content.sections.find(
    (section) => section.id === "changes",
  );
  assert.deepEqual(emptyChanges?.items, []);
  assert.equal(emptyChanges?.empty_state, "no_data");
  assert.ok(
    emptyResult.content.limitations.some(
      (limitation) => limitation.code === "INSUFFICIENT_EVIDENCE",
    ),
  );

  const removedClaim = clone(baseContent());
  const removable = removedClaim.claims.find(
    (claim) => claim.id === "summary-claim",
  );
  assert.ok(removable);
  removable.status = "removed";
  const removedResult = await validateReportContent(removedClaim, contextFor());
  assert.equal(removedResult.status, "valid");
  assert.ok(removedResult.content);
  assert.equal(
    removedResult.content.claims.some((claim) => claim.id === "summary-claim"),
    false,
  );
  assert.equal(
    removedResult.content.sections.some((section) =>
      section.items.some(
        (item) =>
          item.type === "claim_ref" && item.claim_id === "summary-claim",
      ),
    ),
    false,
  );

  const archivedRows = clone(SOURCE_ROWS);
  archivedRows[0].availability = "archived";
  const archivedResult = await validateReportContent(
    baseContent(),
    contextFor(archivedRows),
  );
  assert.equal(archivedResult.status, "limited");
  assert.ok(archivedResult.issue_codes.includes("SOURCE_UNAVAILABLE"));
  assert.ok(archivedResult.content);
  assert.equal(
    archivedResult.content.claims.find((claim) => claim.id === "summary-claim")
      ?.status,
    "limited",
  );

  const unknownAvailabilityRows = clone(SOURCE_ROWS);
  (
    unknownAvailabilityRows[0] as unknown as Record<string, unknown>
  ).availability = "purged";
  const unknownAvailabilityResult = await validateReportContent(
    baseContent(),
    contextFor(unknownAvailabilityRows),
  );
  assert.equal(unknownAvailabilityResult.status, "invalid");
  assert.ok(unknownAvailabilityResult.issue_codes.includes("SOURCE_NOT_FOUND"));

  const tombstonedRows = clone(SOURCE_ROWS);
  tombstonedRows[0].document_state = "tombstoned";
  const tombstonedResult = await validateReportContent(
    baseContent(),
    contextFor(tombstonedRows),
  );
  assert.equal(tombstonedResult.status, "invalid");
  assert.ok(tombstonedResult.issue_codes.includes("SOURCE_UNAVAILABLE"));
  assert.equal(tombstonedResult.content, null);

  const missingDocumentStateRows = clone(SOURCE_ROWS);
  delete (missingDocumentStateRows[0] as unknown as Record<string, unknown>)
    .document_state;
  const missingDocumentStateResult = await validateReportContent(
    baseContent(),
    contextFor(missingDocumentStateRows),
  );
  assert.equal(missingDocumentStateResult.status, "invalid");
  assert.ok(
    missingDocumentStateResult.issue_codes.includes("SOURCE_NOT_FOUND"),
  );

  const unknownDocumentStateRows = clone(SOURCE_ROWS);
  (
    unknownDocumentStateRows[0] as unknown as Record<string, unknown>
  ).document_state = "tombstone";
  const unknownDocumentStateResult = await validateReportContent(
    baseContent(),
    contextFor(unknownDocumentStateRows),
  );
  assert.equal(unknownDocumentStateResult.status, "invalid");
  assert.ok(
    unknownDocumentStateResult.issue_codes.includes("SOURCE_NOT_FOUND"),
  );

  assert.equal(isRecognizedValidatorVersion(CURRENT_VALIDATOR_VERSION), true);
  assert.equal(
    isRecognizedValidatorVersion(RECOGNIZED_VALIDATOR_VERSIONS[0]),
    true,
  );
  assert.equal(isRecognizedValidatorVersion("eh150.retired"), false);
  assert.equal(isRecognizedValidatorVersion(undefined), false);
  assert.equal(
    validatePersistedValidationEnvelope({
      status: "valid",
      version: CURRENT_VALIDATOR_VERSION,
      issue_codes: [],
    }).ok,
    true,
  );
  assert.equal(
    validatePersistedValidationEnvelope({
      status: "valid",
      issue_codes: [],
    }).ok,
    false,
  );
  assert.equal(
    validatePersistedValidationEnvelope({
      status: "valid",
      version: "eh150.unknown",
      issue_codes: [],
    }).ok,
    false,
  );
  assert.equal(
    isPublishableValidationEnvelope({
      status: "valid",
      version: RECOGNIZED_VALIDATOR_VERSIONS[0],
      issue_codes: [],
    }),
    true,
  );
  assert.equal(
    validatePersistedValidationEnvelope({
      status: "limited",
      version: "eh150.retired",
      issue_codes: [],
    }).ok,
    false,
  );
  assert.equal(
    validatePersistedValidationEnvelope({
      status: "valid",
      version: CURRENT_VALIDATOR_VERSION,
      issue_codes: ["SOURCE_NOT_FOUND"],
    }).ok,
    false,
  );

  console.log("verify-eh150-report-citation-validator: all checks passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
