import { MEASUREMENT_DEFINITIONS } from "@/lib/biomarkers";
import BiomarkersPageClient from "./biomarkers-page-client";

const REVIEWED_MEASUREMENT_KEYS = MEASUREMENT_DEFINITIONS.filter(
  (definition) =>
    definition.maturity === "reviewed" &&
    definition.sourceProvenance.kind === "registry_v2_review",
).map((definition) => definition.key);

export default function BiomarkersPage() {
  return (
    <BiomarkersPageClient reviewedMeasurementKeys={REVIEWED_MEASUREMENT_KEYS} />
  );
}
