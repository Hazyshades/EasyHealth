export type {
  BiomarkerDefinition,
  MeasurementDefinition,
  MeasurementAlias,
  MeasurementUnitPolicy,
  NormalizedMeasurementUnit,
  AnalyteKey,
  MeasurementDefinitionKey,
  NormalizedUnitKey,
  UnitDimension,
  CandidateEvidence,
  ResolutionEvidence,
  ResolutionReasonCode,
  MappingConfidenceBand,
  MeasurementResolution,
  MeasurementResolutionInput,
  ResolverResult,
  VerificationStatus,
  AssessmentCompatibility,
  UnitToken,
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

export {
  MEASUREMENT_DEFINITIONS,
  MEASUREMENT_REGISTRY_VERSION,
  MEASUREMENT_RESOLVER_VERSION,
  MEASUREMENT_NORMALIZATION_SCHEMA_VERSION,
  getMeasurementDefinition,
  getMeasurementDefinitionsForAnalyte,
  getMeasurementConversionPolicy,
  normalizeMeasurementUnit,
  normalizeUnitToken,
  resolveMeasurementDefinition,
  validateMeasurementRegistry,
} from "./measurement-resolution";

export {
  MEASUREMENT_REGISTRY_DIGEST,
  MEASUREMENT_REGISTRY_RELEASE,
  buildMeasurementRegistryRelease,
  classifyMeasurementDefinitionChange,
  digestMeasurementRegistryManifest,
  serializeMeasurementRegistryManifest,
  type MappingChangeClassification,
  type MeasurementRegistryChange,
  type MeasurementRegistryRelease,
} from "./measurement-registry-release";
