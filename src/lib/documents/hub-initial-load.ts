export function shouldReuseServerDocuments(input: {
  skipInitialFetch: boolean;
  activeTab: string;
  initialTab: string;
  alreadyConsumedInitial: boolean;
}): boolean {
  return (
    !input.alreadyConsumedInitial &&
    input.skipInitialFetch &&
    input.activeTab === input.initialTab &&
    input.activeTab !== "dicom"
  );
}
