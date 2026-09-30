import { getSessionProfileId } from "@/lib/auth/session";
import { noStoreJson } from "@/lib/documents/access";
import {
  revokeOwnedShare,
  ShareManagementError,
} from "@/lib/share-management/repository";

type RouteContext = { params: Promise<{ id: string }> };

function revokeError(error: unknown) {
  if (error instanceof ShareManagementError) {
    if (error.status === 404) {
      return noStoreJson({ error: "Share not found" }, { status: 404 });
    }
    if (error.status === 409) {
      return noStoreJson(
        { error: "Share has already changed" },
        { status: 409 },
      );
    }
  }
  return noStoreJson({ error: "Share could not be revoked" }, { status: 500 });
}

export async function POST(_request: Request, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId)
    return noStoreJson({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return noStoreJson({ error: "Share not found" }, { status: 404 });

  try {
    await revokeOwnedShare(profileId, id);
    return noStoreJson({ status: "revoked", share_id: id });
  } catch (error) {
    return revokeError(error);
  }
}
