export type {
  BiomarkerDefinition,
  BodySystemId,
  NamedBodySystemId,
  ConversionRule,
  LabUnitSystem,
  PresentedObservation,
  ScoreRole,
  ScoreContributionGroup,
  ScoreRequiredGroup,
  SystemScoreability,
} from "./types";

export {
  BIOMARKER_DEFINITIONS,
  BODY_SYSTEM_LABELS,
  NAMED_BODY_SYSTEMS,
  NON_SCOREABLE_SYSTEMS,
  SCOREABILITY_BY_SYSTEM,
  SCORE_CONTRIBUTION_GROUPS,
  SCORE_REQUIRED_GROUPS,
  buildMarkerToSystemMap,
  getBiomarkerDefinition,
  getScoreRole,
  listCoreKeysForSystem,
  listCoverageKeysForSystem,
  listKeysForSystem,
} from "./catalog";

export {
  ALIAS_MAP,
  normalizeBiomarkerKey,
  normalizeBiomarkerKeyToken,
  resolveCanonicalKey,
  snakeCaseToken,
} from "./normalize";

export { presentObservation, presentObservations, type NativeObservation } from "./units";

export {
  parseLabValueCell,
  inferSpecimen,
  inferModifier,
  observationIdentityKey,
  type ParsedLabValue,
  type ValueKind,
  type Specimen,
  type Modifier,
} from "./qualitative";

export {
  buildPageOcrArtifact,
  isPageOcrArtifact,
  type PageOcrArtifact,
  type PageOcrBlock,
} from "./ocr-artifact";
