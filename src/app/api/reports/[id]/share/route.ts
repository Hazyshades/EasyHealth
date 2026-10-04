import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSessionProfileId } from "@/lib/auth/session";
import { env } from "@/lib/env";
import {
  createReportShare,
  ShareRepositoryError,
} from "@/lib/share-links/repository";
import { hashSharePin, isValidSharePin } from "@/lib/share-links/pin";
import {
  generateShareToken,
  ShareTokenConfigurationError,
  type GeneratedShareToken,
} from "@/lib/share-links/tokens";
type RouteContext = { params: Promise<{ id: string }> };

const CreateShareSchema = z
  .object({
    expires_at: z.string().datetime({ offset: true }),
    pin: z.string().nullable().optional(),
    download_policy: z.enum(["none", "report", "documents"]),
    allowed_export_formats: z
      .array(z.enum(["pdf", "csv", "json"]))
      .max(3)
      .default([]),
    document_ids: z.array(z.string().uuid()).max(100).default([]),
  })
  .strict();

function invalidRequest(): NextResponse {
  return NextResponse.json(
    { error: "Share request is invalid" },
    { status: 400 },
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const profileId = await getSessionProfileId();
  if (!profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }
  const parsed = CreateShareSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();
  if (
    new Set(parsed.data.document_ids).size !== parsed.data.document_ids.length
  ) {
    return invalidRequest();
  }
  if (parsed.data.pin !== undefined && parsed.data.pin !== null) {
    if (!isValidSharePin(parsed.data.pin)) return invalidRequest();
  }

  const expiresAt = new Date(parsed.data.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
    return invalidRequest();
  }
  if (
    parsed.data.download_policy === "none" &&
    parsed.data.allowed_export_formats.length > 0
  ) {
    return invalidRequest();
  }

  let generated: GeneratedShareToken;
  try {
    generated = generateShareToken();
  } catch (error) {
    if (error instanceof ShareTokenConfigurationError) {
      return NextResponse.json(
        { error: "Share service unavailable" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Share service unavailable" },
      { status: 503 },
    );
  }

  let pinHash: string | null = null;
  let pinSalt: string | null = null;
  if (parsed.data.pin) {
    try {
      const hashed = await hashSharePin(parsed.data.pin);
      pinHash = hashed.hash;
      pinSalt = hashed.salt;
    } catch {
      return NextResponse.json(
        { error: "Share service unavailable" },
        { status: 503 },
      );
    }
  }

  try {
    const created = await createReportShare({
      profileId,
      reportId,
      tokenDigest: generated.tokenDigest,
      tokenKeyVersion: generated.tokenKeyVersion,
      pinHash,
      pinSalt,
      expiresAt,
      downloadPolicy: parsed.data.download_policy,
      allowedExportFormats: parsed.data.allowed_export_formats,
      documentIds: parsed.data.document_ids,
    });
    return NextResponse.json({
      share_url: new URL(`/share/${generated.token}`, env.URL).toString(),
      expires_at: created.expires_at,
      download_policy: created.download_policy,
      allowed_export_formats: created.allowed_export_formats,
      pin_required: pinHash !== null,
    });
  } catch (error) {
    if (
      error instanceof ShareRepositoryError ||
      error instanceof ShareTokenConfigurationError
    ) {
      return NextResponse.json(
        { error: "Share request could not be created" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Share service unavailable" },
      { status: 503 },
    );
  }
}
