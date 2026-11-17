import { ClinicIcon } from "@/components/icons";
import { ClinicianPreviewPage } from "@/components/doctor-workspace/preview-page";
import { ClinicWorkspace } from "@/components/doctor-workspace/clinic-workspace";
import { getSessionProfileId } from "@/lib/auth/session";
import { isDoctorWorkspaceEnabled } from "@/lib/doctor-workspace/policy";
export default async function ClinicPage() {
  const profileId = await getSessionProfileId();
  if (profileId && isDoctorWorkspaceEnabled(profileId)) {
    return <ClinicWorkspace />;
  }

  return (
    <ClinicianPreviewPage
      title="Clinic"
      subtitle="Patients, consultations, and medical notes in one workspace"
      icon={ClinicIcon}
      heading="A focused workspace for clinician-led care"
      description="Clinic will bring approved patient relationships, consultations, and source-grounded medical notes into one controlled workspace."
      emptyHeading="No clinic connections"
      emptyDescription="Patient access grants and clinic memberships are not available in this preview."
    />
  );
}
