import { createHmac, randomBytes } from "node:crypto";

const VERSION_PATTERN = /^[A-Za-z0-9._~-]{1,32}$/;
const RANDOM_PATTERN = /^[A-Za-z0-9_-]+$/;
const MIN_RANDOM_BYTES = 32;

export class ShareTokenConfigurationError extends Error {
  constructor() {
    super("Share token configuration unavailable");
    this.name = "ShareTokenConfigurationError";
  }
}

export class InvalidShareTokenError extends Error {
  constructor() {
    super("Invalid share token");
    this.name = "InvalidShareTokenError";
  }
}

type ShareTokenKeyRing = Readonly<{
  currentVersion: string;
  keys: ReadonlyMap<string, string>;
}>;

export type ParsedShareToken = Readonly<{
  tokenKeyVersion: string;
  random: string;
}>;

export type ShareTokenDigest = Readonly<{
  tokenKeyVersion: string;
  tokenDigest: string;
}>;

function keyRing(): ShareTokenKeyRing {
  const raw = process.env.SHARE_TOKEN_KEY_RING;
  const currentVersion = process.env.SHARE_TOKEN_CURRENT_KEY_VERSION?.trim();
  if (!raw || !currentVersion || !VERSION_PATTERN.test(currentVersion)) {
    throw new ShareTokenConfigurationError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ShareTokenConfigurationError();
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ShareTokenConfigurationError();
  }

  const entries = Object.entries(parsed);
  if (entries.length === 0) throw new ShareTokenConfigurationError();
  const keys = new Map<string, string>();
  for (const [version, secret] of entries) {
    if (
      !VERSION_PATTERN.test(version) ||
      typeof secret !== "string" ||
      secret.length < 16
    ) {
      throw new ShareTokenConfigurationError();
    }
    keys.set(version, secret);
  }
  if (!keys.has(currentVersion)) throw new ShareTokenConfigurationError();
  return { currentVersion, keys };
}

function randomHasRequiredEntropy(random: string): boolean {
  if (!RANDOM_PATTERN.test(random)) return false;
  try {
    return Buffer.from(random, "base64url").length >= MIN_RANDOM_BYTES;
  } catch {
    return false;
  }
}

export function parseShareToken(token: string): ParsedShareToken | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const separator = token.indexOf(".");
  if (separator < 2 || separator !== token.lastIndexOf(".")) return null;
  const versionPrefix = token.slice(0, separator);
  const random = token.slice(separator + 1);
  if (!versionPrefix.startsWith("v")) return null;
  const tokenKeyVersion = versionPrefix.slice(1);
  if (
    !VERSION_PATTERN.test(tokenKeyVersion) ||
    !randomHasRequiredEntropy(random)
  ) {
    return null;
  }
  return { tokenKeyVersion, random };
}

function digestRandom(tokenKeyVersion: string, random: string): string {
  const ring = keyRing();
  const key = ring.keys.get(tokenKeyVersion);
  if (!key) throw new InvalidShareTokenError();
  return createHmac("sha256", key).update(random, "ascii").digest("hex");
}

export type GeneratedShareToken = Readonly<{
  token: string;
  tokenKeyVersion: string;
  tokenDigest: string;
}>;

export function generateShareToken(): GeneratedShareToken {
  const ring = keyRing();
  const random = randomBytes(MIN_RANDOM_BYTES).toString("base64url");
  const token = `v${ring.currentVersion}.${random}`;
  return {
    token,
    tokenKeyVersion: ring.currentVersion,
    tokenDigest: digestRandom(ring.currentVersion, random),
  };
}

export function digestShareToken(token: string): ShareTokenDigest {
  const parsed = parseShareToken(token);
  if (!parsed) throw new InvalidShareTokenError();
  return {
    tokenKeyVersion: parsed.tokenKeyVersion,
    tokenDigest: digestRandom(parsed.tokenKeyVersion, parsed.random),
  };
}

export function configuredTokenKeyVersions(): readonly string[] {
  return [...keyRing().keys.keys()];
}
