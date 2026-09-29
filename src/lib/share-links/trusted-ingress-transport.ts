import { createHmac, timingSafeEqual } from "node:crypto";

export type TrustedIngressRuntime = {
  getImmediatePeerAddress(request: Request): string | null;
};

export type TrustedIngressContext = Readonly<{
  edgeVerifiedClientAddress: string;
  edgeRequestId: string;
  edgeTimestamp: number;
}>;

export type TrustedIngressFailure = Readonly<{
  ok: false;
  status: 503;
  reason: "missing_peer" | "untrusted_peer" | "invalid_attestation";
}>;

type Address = Readonly<{
  family: 4 | 6;
  bytes: Uint8Array;
  canonical: string;
}>;

type Cidr = Readonly<{
  address: Address;
  prefixLength: number;
}>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DECIMAL_PATTERN = /^(0|[1-9][0-9]*)$/;
const HEX_PATTERN = /^[0-9a-f]{1,4}$/i;

function parseIpv4(value: string): Address | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const bytes = new Uint8Array(4);
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (
      !part ||
      (part.length > 1 && part.startsWith("0")) ||
      !/^\d+$/.test(part)
    ) {
      return null;
    }
    const number = Number(part);
    if (!Number.isInteger(number) || number > 255) return null;
    bytes[index] = number;
  }
  return {
    family: 4,
    bytes,
    canonical: Array.from(bytes, (byte) => String(byte)).join("."),
  };
}

function parseIpv6(value: string): Address | null {
  if (!value || value.includes(".") || value.includes("%")) return null;
  const compressionCount = value.match(/::/g)?.length ?? 0;
  if (compressionCount > 1) return null;

  const [leftText, rightText] = value.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = compressionCount === 1 && rightText ? rightText.split(":") : [];
  const parts = [...left, ...right];
  if (parts.some((part) => !HEX_PATTERN.test(part))) return null;
  if (compressionCount === 0 && parts.length !== 8) return null;
  if (compressionCount === 1 && parts.length >= 8) return null;

  const hextets = [
    ...left.map((part) => Number.parseInt(part, 16)),
    ...(compressionCount === 1
      ? Array.from({ length: 8 - parts.length }, () => 0)
      : []),
    ...right.map((part) => Number.parseInt(part, 16)),
  ];
  if (hextets.length !== 8) return null;

  const bytes = new Uint8Array(16);
  for (let index = 0; index < hextets.length; index += 1) {
    bytes[index * 2] = hextets[index] >> 8;
    bytes[index * 2 + 1] = hextets[index] & 0xff;
  }

  let bestStart = -1;
  let bestLength = 0;
  let runStart = -1;
  for (let index = 0; index <= hextets.length; index += 1) {
    if (index < hextets.length && hextets[index] === 0) {
      if (runStart === -1) runStart = index;
      continue;
    }
    if (runStart !== -1) {
      const length = index - runStart;
      if (length > bestLength && length >= 2) {
        bestStart = runStart;
        bestLength = length;
      }
      runStart = -1;
    }
  }

  const rendered: string[] = [];
  for (let index = 0; index < hextets.length; index += 1) {
    if (index === bestStart) {
      rendered.push("");
      index += bestLength - 1;
      if (index === hextets.length - 1) rendered.push("");
      continue;
    }
    rendered.push(hextets[index].toString(16));
  }
  let canonical = rendered.join(":");
  if (canonical.startsWith(":") && !canonical.startsWith("::"))
    canonical = `:${canonical}`;
  if (canonical.endsWith(":") && !canonical.endsWith("::"))
    canonical = `${canonical}:`;

  const address: Address = { family: 6, bytes, canonical };
  return value === canonical ? address : null;
}

export function parseCanonicalAddress(value: string): Address | null {
  if (!value || value.trim() !== value || value.includes(",")) return null;
  return parseIpv4(value) ?? parseIpv6(value);
}

function parseCidr(value: string): Cidr | null {
  const parts = value.split("/");
  if (parts.length !== 2 || !DECIMAL_PATTERN.test(parts[1])) return null;
  const address = parseCanonicalAddress(parts[0]);
  if (!address) return null;
  const prefixLength = Number(parts[1]);
  const maxPrefix = address.family === 4 ? 32 : 128;
  if (
    !Number.isInteger(prefixLength) ||
    prefixLength < 0 ||
    prefixLength > maxPrefix
  ) {
    return null;
  }
  return { address, prefixLength };
}

export function isAddressInCidr(address: Address, cidr: Cidr): boolean {
  if (address.family !== cidr.address.family) return false;
  const fullBytes = Math.floor(cidr.prefixLength / 8);
  const remainingBits = cidr.prefixLength % 8;
  for (let index = 0; index < fullBytes; index += 1) {
    if (address.bytes[index] !== cidr.address.bytes[index]) return false;
  }
  if (remainingBits === 0) return true;
  const mask = 0xff << (8 - remainingBits);
  return (
    (address.bytes[fullBytes] & mask) === (cidr.address.bytes[fullBytes] & mask)
  );
}

function configuredCidrs(): Cidr[] | null {
  const raw = process.env.SHARE_TRUSTED_PROXY_CIDRS?.trim();
  if (!raw) return null;
  const cidrs = raw.split(",").map((value) => parseCidr(value.trim()));
  return cidrs.every((cidr): cidr is Cidr => cidr !== null) ? cidrs : null;
}

function singleHeader(request: Request, name: string): string | null {
  const value = request.headers.get(name);
  if (!value || value.trim() !== value || value.includes(",")) return null;
  return value;
}

function failure(
  reason: TrustedIngressFailure["reason"],
): TrustedIngressFailure {
  return { ok: false, status: 503, reason };
}

export function getTrustedIngressContext(
  request: Request,
  runtime: TrustedIngressRuntime,
  nowSeconds = Math.floor(Date.now() / 1000),
): TrustedIngressContext | TrustedIngressFailure {
  let immediatePeer: string | null;
  try {
    immediatePeer = runtime.getImmediatePeerAddress(request);
  } catch {
    return failure("missing_peer");
  }
  const peerAddress = immediatePeer
    ? parseCanonicalAddress(immediatePeer)
    : null;
  const cidrs = configuredCidrs();
  if (!peerAddress || !cidrs) return failure("missing_peer");
  if (!cidrs.some((cidr) => isAddressInCidr(peerAddress, cidr))) {
    return failure("untrusted_peer");
  }

  const clientAddressValue = singleHeader(request, "X-EH-Edge-Client-Address");
  const requestId = singleHeader(request, "X-EH-Edge-Request-Id");
  const timestampValue = singleHeader(request, "X-EH-Edge-Timestamp");
  const signature = singleHeader(request, "X-EH-Edge-Signature");
  const clientAddress = clientAddressValue
    ? parseCanonicalAddress(clientAddressValue)
    : null;
  if (
    !clientAddress ||
    !requestId ||
    !UUID_PATTERN.test(requestId) ||
    !timestampValue ||
    !DECIMAL_PATTERN.test(timestampValue) ||
    !signature ||
    !/^[A-Za-z0-9_-]+$/.test(signature)
  ) {
    return failure("invalid_attestation");
  }

  const timestamp = Number(timestampValue);
  const maxAgeRaw =
    process.env.SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS?.trim();
  const maxAge = maxAgeRaw === undefined ? 30 : Number(maxAgeRaw);
  const key = process.env.SHARE_TRUSTED_PROXY_ATTESTATION_KEY?.trim();
  if (
    !Number.isSafeInteger(timestamp) ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < 5 ||
    maxAge > 120 ||
    !key
  ) {
    return failure("invalid_attestation");
  }
  if (Math.abs(nowSeconds - timestamp) > maxAge) {
    return failure("invalid_attestation");
  }

  const frame = `${requestId}.${timestampValue}.${clientAddress.canonical}`;
  const expected = createHmac("sha256", key)
    .update(frame, "utf8")
    .digest("base64url");
  const expectedBytes = Buffer.from(expected, "ascii");
  const signatureBytes = Buffer.from(signature, "ascii");
  if (
    expectedBytes.length !== signatureBytes.length ||
    !timingSafeEqual(expectedBytes, signatureBytes)
  ) {
    return failure("invalid_attestation");
  }

  return {
    edgeVerifiedClientAddress: clientAddress.canonical,
    edgeRequestId: requestId,
    edgeTimestamp: timestamp,
  };
}
