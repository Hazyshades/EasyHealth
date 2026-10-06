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

const target = new URL(
  process.env.TRUSTED_INGRESS_TARGET_URL ?? "http://host.docker.internal:3000",
);
const port = Number(process.env.TRUSTED_INGRESS_PORT ?? "8443");
const attestationKey = process.env.SHARE_TRUSTED_PROXY_ATTESTATION_KEY?.trim();
const allowInsecureLocal =
  process.env.TRUSTED_INGRESS_ALLOW_INSECURE_LOCAL === "1";
const tlsEnabled = process.env.TRUSTED_INGRESS_TLS === "1";
const maxAgeSeconds = Number(
  process.env.SHARE_TRUSTED_PROXY_ATTESTATION_MAX_AGE_SECONDS ?? "30",
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

function failure(response, status, message) {
  response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(message);
}

function isPublicSharePath(url) {
  return url.startsWith("/share/") || url.startsWith("/api/share/");
}

function proxyRequest(request, response) {
  const path = request.url ?? "/";
  if (!isPublicSharePath(path)) {
    failure(response, 404, "Not found");
    return;
  }

  const clientAddress = canonicalAddress(request.socket.remoteAddress);
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
      rejectUnauthorized:
        target.protocol !== "https:" ||
        process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
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

const server = tlsEnabled
  ? createHttpsServer(
      {
        key: readFileSync(process.env.TRUSTED_INGRESS_TLS_KEY_FILE),
        cert: readFileSync(process.env.TRUSTED_INGRESS_TLS_CERT_FILE),
      },
      proxyRequest,
    )
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
