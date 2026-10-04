import { getSessionProfileId } from "@/lib/auth/session";
import { noStoreJson } from "@/lib/documents/access";
import {
  listOwnedShares,
  ShareManagementError,
} from "@/lib/share-management/repository";

function managementError(error: unknown) {
  if (error instanceof ShareManagementError) {
    return noStoreJson(
      {
        error:
          error.status === 500
            ? "Share management is unavailable"
            : "The requested share was not found",
      },
      { status: error.status },
    );
  }

  return noStoreJson(
    { error: "Share management is unavailable" },
    { status: 500 },
  );
}

export async function GET() {
  const profileId = await getSessionProfileId();
  if (!profileId)
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });

  try {
    return noStoreJson({ shares: await listOwnedShares(profileId) });
  } catch (error) {
    return managementError(error);
  }
}
