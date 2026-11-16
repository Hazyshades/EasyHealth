import { MicrophoneIcon } from "@/components/icons";
import { ClinicianPreviewPage } from "@/components/doctor-workspace/preview-page";

export default function DictaphonePage() {
  return (
    <ClinicianPreviewPage
      title="Dictaphone"
      subtitle="Record a consultation, then turn it into a structured note"
      icon={MicrophoneIcon}
      heading="A private place for consultation notes"
      description="Dictaphone will keep consented recordings, transcript drafts, and clinician-reviewed notes separate and source-grounded."
      emptyHeading="No consultation recordings"
      emptyDescription="Recording, transcription, and note review are not available in this preview."
    />
  );
}
