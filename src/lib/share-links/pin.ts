import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PIN_MIN_LENGTH = 4;
const PIN_MAX_LENGTH = 64;
const SALT_BYTES = 16;
const PROOF_BYTES = 32;
const HASH_BYTES = 32;
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;

const scryptAsync = (password: string, salt: Buffer): Promise<Buffer> => {
  const { promise, resolve, reject } = Promise.withResolvers<Buffer>();
  scrypt(
    password,
    salt,
    HASH_BYTES,
    {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    },
    (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    },
  );
  return promise;
};
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export const SHARE_PIN_COOKIE = "__Host-eh-share-pin";

export class SharePinConfigurationError extends Error {
  constructor() {
    super("Share PIN configuration unavailable");
    this.name = "SharePinConfigurationError";
  }
}

export function isValidSharePin(pin: unknown): pin is string {
  return (
    typeof pin === "string" &&
    pin.length >= PIN_MIN_LENGTH &&
    pin.length <= PIN_MAX_LENGTH
  );
}

function encoded(value: Buffer): string {
  return value.toString("base64url");
}

function decoded(value: string): Buffer | null {
  if (!value || !BASE64URL_PATTERN.test(value)) return null;
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

async function derivePinHash(pin: string, salt: Buffer): Promise<Buffer> {
  return scryptAsync(pin, salt);
}

export async function hashSharePin(pin: string): Promise<{
  hash: string;
  salt: string;
}> {
  if (!isValidSharePin(pin)) throw new Error("Invalid share PIN");
  const salt = randomBytes(SALT_BYTES);
  const hash = await derivePinHash(pin, salt);
  return {
    hash: `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${encoded(hash)}`,
    salt: encoded(salt),
  };
}

export async function verifySharePin(
  pin: unknown,
  hash: string | null,
  salt: string | null,
): Promise<boolean> {
  if (!isValidSharePin(pin) || !hash || !salt) return false;
  const parts = hash.split("$");
  if (
    parts.length !== 5 ||
    parts[0] !== "scrypt" ||
    parts[1] !== String(SCRYPT_N) ||
    parts[2] !== String(SCRYPT_R) ||
    parts[3] !== String(SCRYPT_P)
  ) {
    return false;
  }
  const saltBytes = decoded(salt);
  const expected = decoded(parts[4]);
  if (!saltBytes || saltBytes.length !== SALT_BYTES || !expected) return false;
  const actual = await derivePinHash(pin, saltBytes);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function proofPepper(): string {
  const value = process.env.SHARE_PIN_PROOF_PEPPER?.trim();
  if (!value || value.length < 16) throw new SharePinConfigurationError();
  return value;
}

export function proofDigest(proof: string): string {
  if (!proof || !BASE64URL_PATTERN.test(proof)) {
    throw new SharePinConfigurationError();
  }
  return createHmac("sha256", proofPepper())
    .update(proof, "ascii")
    .digest("hex");
}

export function generatePinProof(): Readonly<{
  proof: string;
  proofDigest: string;
}> {
  const proof = randomBytes(PROOF_BYTES).toString("base64url");
  return { proof, proofDigest: proofDigest(proof) };
}

export function pinProofTtlSeconds(): number {
  const raw = process.env.SHARE_PIN_PROOF_TTL_SECONDS?.trim();
  const value = raw === undefined ? 900 : Number(raw);
  if (!Number.isInteger(value) || value < 60 || value > 3_600) {
    throw new SharePinConfigurationError();
  }
  return value;
}
