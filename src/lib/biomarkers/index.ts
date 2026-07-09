export type {
  BiomarkerDefinition,
  BodySystemId,
  ConversionRule,
  LabUnitSystem,
  PresentedObservation,
  ScoreRole,
} from "./types";

export {
  BIOMARKER_DEFINITIONS,
  BODY_SYSTEM_LABELS,
  NAMED_BODY_SYSTEMS,
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
