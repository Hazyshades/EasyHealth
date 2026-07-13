export const WIZARD_STEP_IDS = ["upload", "biomarkers", "report"] as const;
export type WizardStepId = (typeof WIZARD_STEP_IDS)[number];

export function isWizardStepId(value: string): value is WizardStepId {
  return (WIZARD_STEP_IDS as readonly string[]).includes(value);
}
