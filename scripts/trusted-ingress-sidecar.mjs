import { randomUUID, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  createServer as createHttpServer,
  request as httpRequest,
} from "node:http";
import {
  createServer as createHttpsServer,
  request as httpsRequest,
} from "node:https";
import { createServer as createNetServer } from "node:net";
import { createServer as createTlsServer } from "node:tls";

const target = new URL(
  process.env.TRUSTED_INGRESS_TARGET_URL ?? "http://host.docker.internal:3000",
);
const port = Number(process.env.TRUSTED_INGRESS_PORT ?? "8443");
const attestationKey = process.env.SHARE_TRUSTED_PROXY_ATTESTATION_KEY?.trim();
const allowInsecureLocal =
  process.env.TRUSTED_INGRESS_ALLOW_INSECURE_LOCAL === "1";
const tlsEnabled = process.env.TRUSTED_INGRESS_TLS === "1";
const proxyProtocol = process.env.TRUSTED_INGRESS_PROXY_PROTOCOL?.trim() ?? "";
const requireClientCertificate =
  process.env.TRUSTED_INGRESS_REQUIRE_CLIENT_CERT === "1";
const maxAgeSeconds = Number(
  process.env.SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS ?? "30",
);
const MAX_PROXY_HEADER_BYTES = 16 * 1024;
const PROXY_V2_SIGNATURE = Buffer.from(
  "\r\n\r\n\0\r\nQUIT\n",
  "binary",
);

if (!attestationKey)
  throw new Error("SHARE_TRUSTED_PROXY_ATTESTATION_KEY is required");
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error(
    "TRUSTED_INGRESS_PORT must be an integer between 1 and 65535",
  );
}
if (
  !Number.isInteger(maxAgeSeconds) ||
  maxAgeSeconds < 5 ||
  maxAgeSeconds > 120
) {
  throw new Error("SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS is invalid");
}
if (!tlsEnabled && !allowInsecureLocal) {
  throw new Error(
    "TLS is required unless TRUSTED_INGRESS_ALLOW_INSECURE_LOCAL=1",
  );
}
if (proxyProtocol && !["v1", "v2"].includes(proxyProtocol)) {
  throw new Error("TRUSTED_INGRESS_PROXY_PROTOCOL must be v1 or v2");
}
if (proxyProtocol && !tlsEnabled) {
  throw new Error("PROXY protocol requires TLS");
}

function requiredFile(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return readFileSync(value);
}

const tlsOptions = tlsEnabled
  ? {
      key: requiredFile("TRUSTED_INGRESS_TLS_KEY_FILE"),
      cert: requiredFile("TRUSTED_INGRESS_TLS_CERT_FILE"),
      ...(requireClientCertificate
        ? {
            ca: requiredFile("TRUSTED_INGRESS_TLS_CA_FILE"),
            requestCert: true,
            rejectUnauthorized: true,
          }
        : {}),
    }
  : null;

const upstreamTlsOptions =
  target.protocol === "https:"
    ? {
        ca: requiredFile("TRUSTED_INGRESS_TARGET_CA_FILE"),
        cert: requiredFile("TRUSTED_INGRESS_TARGET_CERT_FILE"),
        key: requiredFile("TRUSTED_INGRESS_TARGET_KEY_FILE"),
        rejectUnauthorized: true,
        ...(process.env.TRUSTED_INGRESS_TARGET_SERVER_NAME?.trim()
          ? { servername: process.env.TRUSTED_INGRESS_TARGET_SERVER_NAME.trim() }
          : {}),
      }
    : {};

const strippedHeaders = new Set([
  "forwarded",
  "x-forwarded-for",
  "x-real-ip",
  "x-eh-edge-client-address",
  "x-eh-edge-request-id",
  "x-eh-edge-timestamp",
  "x-eh-edge-signature",
]);

function canonicalAddress(value) {
  if (!value) return null;
  const normalized = value.startsWith("::ffff:")
    ? value.slice("::ffff:".length)
    : value;
  return normalized.includes(",") || normalized.includes("%")
    ? null
    : normalized;
}

function ipv4Address(buffer, offset) {
  return Array.from(buffer.subarray(offset, offset + 4)).join(".");
}

function ipv6Address(buffer, offset) {
  return Array.from({ length: 8 }, (_, index) =>
    buffer.readUInt16BE(offset + index * 2).toString(16),
  ).join(":");
}

function parseProxyV1(buffer) {
  const lineEnd = buffer.indexOf("\r\n");
  if (lineEnd < 0) {
    if (buffer.length > 108) throw new Error("PROXY v1 header is too long");
    return null;
  }
  const line = buffer.subarray(0, lineEnd).toString("ascii");
  const fields = line.split(" ");
  if (fields[0] !== "PROXY") throw new Error("Invalid PROXY v1 header");
  if (fields[1] === "UNKNOWN") {
    throw new Error("PROXY v1 header has no client address");
  }
  if (fields.length !== 6 || !["TCP4", "TCP6"].includes(fields[1])) {
    throw new Error("Unsupported PROXY v1 header");
  }
  const clientAddress = canonicalAddress(fields[2]);
  if (!clientAddress) throw new Error("Invalid PROXY v1 client address");
  return { clientAddress, consumed: lineEnd + 2 };
}

function parseProxyV2(buffer) {
  if (buffer.length < 16) return null;
  if (!buffer.subarray(0, 12).equals(PROXY_V2_SIGNATURE)) {
    throw new Error("Invalid PROXY v2 signature");
  }
  const payloadLength = buffer.readUInt16BE(14);
  const totalLength = 16 + payloadLength;
  if (totalLength > MAX_PROXY_HEADER_BYTES) {
    throw new Error("PROXY v2 header is too long");
  }
  if (buffer.length < totalLength) return null;

  const command = buffer[12] & 0x0f;
  if (command !== 1) throw new Error("PROXY v2 header is not a proxy command");
  const family = buffer[13] >> 4;
  const clientAddress =
    family === 1
      ? canonicalAddress(ipv4Address(buffer, 16))
      : family === 2
        ? canonicalAddress(ipv6Address(buffer, 16))
        : null;
  if (!clientAddress) throw new Error("PROXY v2 header has no client address");
  return { clientAddress, consumed: totalLength };
}

function parseProxyHeader(buffer) {
  if (proxyProtocol === "v1") return parseProxyV1(buffer);
  return parseProxyV2(buffer);
}

function readProxyHeader(socket, onParsed) {
  let buffered = Buffer.alloc(0);
  const onData = (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    if (buffered.length > MAX_PROXY_HEADER_BYTES) {
      socket.destroy();
      return;
    }
    let parsed;
    try {
      parsed = parseProxyHeader(buffered);
    } catch {
      socket.destroy();
      return;
    }
    if (!parsed) return;
    socket.off("data", onData);
    socket.pause();
    const remaining = buffered.subarray(parsed.consumed);
    if (remaining.length > 0) socket.unshift(remaining);
    onParsed(parsed.clientAddress);
  };
  socket.on("data", onData);
  socket.on("error", () => {});
}

function failure(response, status, message) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function isPublicSharePath(url) {
  return (
    url.startsWith("/share/") ||
    url.startsWith("/api/share/") ||
    url.startsWith("/_next/static/")
  );
}


function proxyRequest(request, response) {
  const path = request.url ?? "/";
  if (!isPublicSharePath(path)) {
    failure(response, 404, "Not found");
    return;
  }

  const clientAddress = canonicalAddress(
    request.socket.__trustedClientAddress ?? request.socket.remoteAddress,
  );
  if (!clientAddress) {
    failure(response, 503, "Share service unavailable");
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const requestId = randomUUID();
  const frame = `${requestId}.${timestamp}.${clientAddress}`;
  const signature = createHmac("sha256", attestationKey)
    .update(frame, "utf8")
    .digest("base64url");
  const headers = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (!strippedHeaders.has(name)) headers[name] = value;
  }
  headers.host = target.host;
  headers["x-eh-edge-client-address"] = clientAddress;
  headers["x-eh-edge-request-id"] = requestId;
  headers["x-eh-edge-timestamp"] = String(timestamp);
  headers["x-eh-edge-signature"] = signature;

  const transport = target.protocol === "https:" ? httpsRequest : httpRequest;
  const upstream = transport(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: request.method,
      path,
      headers,
      ...upstreamTlsOptions,
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.statusMessage,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    },
  );

  upstream.on("error", () => {
    if (!response.headersSent)
      failure(response, 503, "Share service unavailable");
    else response.destroy();
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
}

function createProxyProtocolTlsServer() {
  const httpServer = createHttpServer(proxyRequest);
  const tlsServer = createTlsServer(tlsOptions);
  tlsServer.on("secureConnection", (secureSocket) => {
    secureSocket.__trustedClientAddress =
      secureSocket._parent?.__trustedClientAddress ?? null;
    httpServer.emit("connection", secureSocket);
  });
  tlsServer.on("tlsClientError", () => {});

  return createNetServer((socket) => {
    readProxyHeader(socket, (clientAddress) => {
      socket.__trustedClientAddress = clientAddress;
      tlsServer.emit("connection", socket);
    });
  });
}

const server =
  tlsEnabled && proxyProtocol
    ? createProxyProtocolTlsServer()
    : tlsEnabled
      ? createHttpsServer(tlsOptions, proxyRequest)
      : createHttpServer(proxyRequest);

server.on("error", (error) => {
  console.error("Trusted ingress sidecar error:", error);
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () => {
  console.log(
    `Trusted ingress sidecar ready on ${tlsEnabled ? "https" : "http"}://0.0.0.0:${port}`,
  );
});
