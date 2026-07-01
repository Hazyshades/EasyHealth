import { NextRequest, NextResponse } from "next/server";
import { getSessionProfileId } from "@/lib/auth/session";
import { withGateway } from "@/lib/x402";
import { forceRegenerateHolisticSynthesis } from "@/lib/holistic-synthesis";

const SYNTHESIS_PRICE = process.env.X402_SYNTHESIS_PRICE ?? "$0.02";

async function handler(_req: NextRequest, payment: import("@/lib/x402").SettledPayment) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const synthesis = await forceRegenerateHolisticSynthesis(profileId);
  if (!synthesis) {
    return NextResponse.json(
      { error: "No structured documents available for synthesis" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    synthesis_text: synthesis.text,
    generated_at: synthesis.generated_at,
    source_document_ids: synthesis.source_document_ids,
    disclaimer: synthesis.disclaimer,
    payment_receipt: {
      payer: payment.payer,
      amount_usdc: payment.amountUsdc,
      gateway_tx: payment.gatewayTx,
      network: payment.network,
    },
  });
}

export const POST = withGateway(handler, SYNTHESIS_PRICE, "/api/health-profile/synthesis", {
  getProfileId: getSessionProfileId,
});

export const maxDuration = 60;
